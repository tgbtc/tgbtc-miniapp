export default async function handler(req, res) {
  try {
    const key = process.env.TONAPI_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });

    // DexScreener pairId (как у тебя)
    const CHAIN = "ton";
    const PAIR_ID = "eqd8tj8xewb1spnre4d89yo3jl0w0eibnns4ibahaumdfize";

    async function getJSON(url, headers = {}) {
      const r = await fetch(url, { headers: { accept: "application/json", ...headers } });
      const txt = await r.text();
      let data = null;
      try { data = JSON.parse(txt); } catch {}
      return { ok: r.ok, status: r.status, data, raw: txt };
    }

    // 1) Берём НОРМАЛЬНЫЙ адрес пула из DexScreener ответа
    const ds = await getJSON(`https://api.dexscreener.com/latest/dex/pairs/${CHAIN}/${PAIR_ID}`);
    if (!ds.ok || !ds.data) {
      return res.status(502).json({ ok: false, error: "DexScreener fetch failed", status: ds.status });
    }

    const pair = Array.isArray(ds.data?.pairs) ? ds.data.pairs[0] : (ds.data?.pair ?? ds.data);
    const poolAddr = pair?.pairAddress;

    if (!poolAddr) {
      return res.status(502).json({ ok: false, error: "pairAddress not found in DexScreener response" });
    }

    // 2) TonAPI events по этому адресу (TonAPI принимает именно адрес аккаунта контракта)
    const ev = await getJSON(
      `https://tonapi.io/v2/accounts/${encodeURIComponent(poolAddr)}/events?limit=50`,
      { Authorization: `Bearer ${key}` }
    );

    if (!ev.ok || !ev.data) {
      return res.status(502).json({ ok: false, error: "TonAPI events fetch failed", status: ev.status });
    }

    const events = Array.isArray(ev.data?.events) ? ev.data.events : [];
    const now = Math.floor(Date.now() / 1000);
    const windowSec = 15 * 60;
    const recent = events.filter(x => Number(x?.timestamp) >= (now - windowSec));
    const n = recent.length;

    let level = "LOW";
    if (n >= 12) level = "HIGH";
    else if (n >= 4) level = "MEDIUM";

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    return res.json({
      ok: true,
      poolAddr,
      windowSec,
      recentEvents: n,
      level,
      source: "dexscreener(pairAddress)->tonapi(events)"
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
