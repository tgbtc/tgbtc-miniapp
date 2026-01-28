export default async function handler(req, res) {
  try {
    const RPC = "https://sandbox.teleport.tg/api/v2/jsonRPC";

    async function call(method, params = {}) {
      const r = await fetch(RPC, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "user-agent": "Mozilla/5.0"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params
        })
      });

      const j = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, json: j };
    }

    function findInObject(obj) {
      // ищем tb1... и remaining в любом месте ответа
      const s = JSON.stringify(obj);

      const addrMatch = s.match(/\b(tb1[qp][a-z0-9]{20,})\b/i);
      let btc_address = addrMatch ? addrMatch[1] : null;

      // remaining может быть:
      // - seconds: 2855
      // - ms: 2855000
      // - {minutes: 47, seconds: 35}
      // - "47m : 35s" (редко в json)
      let remaining_seconds = null;

      // seconds key
      const secMatch = s.match(/"remaining(?:_)?seconds"\s*:\s*(\d{1,6})/i)
        || s.match(/"expires(?:_)?in"\s*:\s*(\d{1,6})/i)
        || s.match(/"ttl"\s*:\s*(\d{1,6})/i);

      if (secMatch) remaining_seconds = parseInt(secMatch[1], 10);

      // ms key
      if (!remaining_seconds) {
        const msMatch = s.match(/"remaining(?:_)?ms"\s*:\s*(\d{1,9})/i)
          || s.match(/"expires(?:_)?in(?:_)?ms"\s*:\s*(\d{1,9})/i);
        if (msMatch) remaining_seconds = Math.floor(parseInt(msMatch[1], 10) / 1000);
      }

      // minutes + seconds
      if (!remaining_seconds) {
        const mMatch = s.match(/"minutes"\s*:\s*(\d{1,3})/i);
        const sMatch = s.match(/"seconds"\s*:\s*(\d{1,2})/i);
        if (mMatch && sMatch) {
          remaining_seconds = parseInt(mMatch[1], 10) * 60 + parseInt(sMatch[1], 10);
        }
      }

      // "47m : 35s"
      if (!remaining_seconds) {
        const txt = s.match(/(\d{1,3})\s*m\s*:\s*(\d{1,2})\s*s/i);
        if (txt) remaining_seconds = parseInt(txt[1], 10) * 60 + parseInt(txt[2], 10);
      }

      // sanity: remaining должен быть 1..3600
      if (remaining_seconds !== null) {
        if (!(remaining_seconds >= 0 && remaining_seconds <= 3600)) {
          remaining_seconds = null;
        }
      }

      return { btc_address, remaining_seconds };
    }

    // набор вероятных методов (Teleport/Bridge обычно так называют)
    const methods = [
      "getDepositAddress",
      "getDeposit",
      "getDepositCreds",
      "getDepositCredentials",
      "getPeginAddress",
      "getPeginCredentials",
      "getPeginCreds",
      "getMintAddress",
      "getBridgeState",
      "getConfig",
      "getAppState",
      "getState",
      "getSession",
      "getDashboard"
    ];

    let best = { btc_address: null, remaining_seconds: null };
    let debugTried = [];

    for (const m of methods) {
      const resp = await call(m, {});
      debugTried.push({ method: m, ok: resp.ok, status: resp.status });

      if (!resp.ok || !resp.json) continue;

      const found = findInObject(resp.json);

      if (found.btc_address) best.btc_address = found.btc_address;
      if (found.remaining_seconds !== null) best.remaining_seconds = found.remaining_seconds;

      if (best.btc_address && best.remaining_seconds !== null) break;
    }

    res.setHeader("Cache-Control", "no-store");

    // если не нашли — вернём debug, чтобы за 1 шаг добить точным методом
    if (!best.btc_address && best.remaining_seconds === null) {
      return res.status(200).json({
        ok: false,
        error: "Could not extract btc_address/remaining_seconds from jsonRPC methods list",
        tried: debugTried
      });
    }

    return res.status(200).json({ ok: true, ...best });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
