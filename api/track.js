export default async function handler(req, res) {
  try {
    const JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing in Vercel env" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // 1) Supply (v2)
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(JETTON_MASTER)}`;

    // 2) Last transfers (v3)
    // docs: /api/v3/jetton/transfers :contentReference[oaicite:3]{index=3}
    const transfersUrl =
      `https://testnet.toncenter.com/api/v3/jetton/transfers?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=50&sort=desc`;

    // 3) Last burns (v3)
    // docs: /api/v3/jetton/burns :contentReference[oaicite:4]{index=4}
    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=50&sort=desc`;

    const [supplyRes, transfersRes, burnsRes] = await Promise.all([
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(transfersUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const supplyText = await supplyRes.text();
    const transfersText = await transfersRes.text();
    const burnsText = await burnsRes.text();

    let supplyJson, transfersJson, burnsJson;
    try { supplyJson = JSON.parse(supplyText); } catch { return res.status(502).json({ ok:false, error:"Supply: non-json", raw:supplyText.slice(0,500) }); }
    try { transfersJson = JSON.parse(transfersText); } catch { return res.status(502).json({ ok:false, error:"Transfers: non-json", raw:transfersText.slice(0,500) }); }
    try { burnsJson = JSON.parse(burnsText); } catch { return res.status(502).json({ ok:false, error:"Burns: non-json", raw:burnsText.slice(0,500) }); }

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok:false, error:"Supply error", raw:supplyJson });
    }

    const r = supplyJson.result;

    const decimalsStr =
      r?.jetton_content?.data?.decimals ??
      r?.jetton_content?.decimals ??
      "0";

    const decimals = Number(decimalsStr);
    const totalSupplyRaw = String(r.total_supply);

    // ----- Build events -----

    // 1) mint candidates: transfers where source == jetton_master and not aborted
    const transfers = Array.isArray(transfersJson?.jetton_transfers) ? transfersJson.jetton_transfers : [];
    const mintCandidates = transfers
      .filter(x => x && x.transaction_aborted !== true)
      .filter(x => (x.source || "") === JETTON_MASTER)
      .slice(0, 10)
      .map(x => ({
        type: "MINT",
        now: Number(x.transaction_now || 0),
        amount: String(x.amount || "0"),
        address: String(x.destination || ""), // who received
        tx_hash: String(x.transaction_hash || ""),
      }));

    // 2) burn candidates
    const burns = Array.isArray(burnsJson?.jetton_burns) ? burnsJson.jetton_burns : [];
    const burnCandidates = burns
      .filter(x => x && x.transaction_aborted !== true)
      .slice(0, 10)
      .map(x => ({
        type: "BURN",
        now: Number(x.transaction_now || 0),
        amount: String(x.amount || "0"),
        address: String(x.owner || ""), // who burned
        tx_hash: String(x.transaction_hash || ""),
      }));

    // merge and take latest 3 (by time)
    const events = [...mintCandidates, ...burnCandidates]
      .filter(e => e.now > 0 && e.address)
      .sort((a,b) => b.now - a.now)
      .slice(0, 3);

    return res.status(200).json({
      ok: true,
      jetton_master: JETTON_MASTER,
      decimals,
      total_supply: totalSupplyRaw,
      events,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
