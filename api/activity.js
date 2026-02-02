export default async function handler(req, res) {
  try {
    const JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing in Vercel env" });
    }

    // 1) Supply (v2)
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(JETTON_MASTER)}`;

    // 2) Last tx time/hash (v3)
    const txUrl =
      `https://testnet.toncenter.com/api/v3/transactions?account=${encodeURIComponent(JETTON_MASTER)}&limit=1&sort=desc`;

    const headers = {
      "accept": "application/json",
      "X-API-Key": API_KEY,
    };

    const [supplyRes, txRes] = await Promise.all([
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(txUrl, { headers, cache: "no-store" }),
    ]);

    const supplyText = await supplyRes.text();
    const txText = await txRes.text();

    let supplyJson, txJson;
    try { supplyJson = JSON.parse(supplyText); } catch {
      return res.status(502).json({ ok: false, error: "Supply: toncenter returned non-json", raw: supplyText.slice(0, 500) });
    }
    try { txJson = JSON.parse(txText); } catch {
      return res.status(502).json({ ok: false, error: "Tx: toncenter returned non-json", raw: txText.slice(0, 500) });
    }

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: `Supply error`, raw: supplyJson });
    }

    // tx endpoint может вернуть 200 даже если список пустой
    const lastTx = Array.isArray(txJson?.transactions) && txJson.transactions.length
      ? txJson.transactions[0]
      : null;

    const r = supplyJson.result;
    const decimalsStr =
      r?.jetton_content?.data?.decimals ??
      r?.jetton_content?.decimals ??
      "0";

    return res.status(200).json({
      ok: true,
      jetton_master: JETTON_MASTER,
      total_supply: String(r.total_supply),
      decimals: Number(decimalsStr),
      last_tx: lastTx ? { now: lastTx.now, hash: lastTx.account_state_after?.hash || lastTx.hash || null, lt: lastTx.lt } : null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
