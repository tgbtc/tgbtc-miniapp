export default async function handler(req, res) {
  try {
    const MASTER_FRIENDLY = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // 0) convert friendly -> raw (0:...) so comparisons work
    const unpackUrl =
      `https://testnet.toncenter.com/api/v2/unpackAddress?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 1) supply
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 2) transfers (we will filter by source == raw master to detect "Mint token")
    const transfersUrl =
      `https://testnet.toncenter.com/api/v3/jetton/transfers?jetton_master=${encodeURIComponent(MASTER_FRIENDLY)}&limit=200&sort=desc`;

    // 3) burns
    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(MASTER_FRIENDLY)}&limit=50&sort=desc`;

    const [unpackRes, supplyRes, transfersRes, burnsRes] = await Promise.all([
      fetch(unpackUrl, { headers, cache: "no-store" }),
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(transfersUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const unpackJson = await unpackRes.json();
    const supplyJson = await supplyRes.json();
    const transfersJson = await transfersRes.json();
    const burnsJson = await burnsRes.json();

    if (!unpackRes.ok || unpackJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "unpackAddress error", raw: unpackJson });
    }
    const MASTER_RAW = String(unpackJson.result); // "0:...."

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "Supply error", raw: supplyJson });
    }

    const r = supplyJson.result;
    const decimals =
      Number(r?.jetton_content?.data?.decimals ?? r?.jetton_content?.decimals ?? "0");
    const totalSupply = String(r.total_supply);

    const transfers = Array.isArray(transfersJson?.jetton_transfers)
      ? transfersJson.jetton_transfers
      : [];

    const burns = Array.isArray(burnsJson?.jetton_burns)
      ? burnsJson.jetton_burns
      : [];

    // ✅ MINT token like tonviewer: "tgBTC -> address"
    // It is a jetton transfer where source == MASTER_RAW
    const mints = transfers
      .filter(t => t && t.transaction_aborted !== true)
      .filter(t => String(t.source || "") === MASTER_RAW)
      .map(t => ({
        type: "MINT",
        now: Number(t.transaction_now || 0),
        address: String(t.destination || ""),   // who received tgBTC
        amount: String(t.amount || "0"),
        tx_hash: String(t.transaction_hash || ""),
      }));

    // ✅ BURN token
    const burnsNorm = burns
      .filter(b => b && b.transaction_aborted !== true)
      .map(b => ({
        type: "BURN",
        now: Number(b.transaction_now || 0),
        address: String(b.owner || ""),         // who burned tgBTC
        amount: String(b.amount || "0"),
        tx_hash: String(b.transaction_hash || ""),
      }));

    // last 3 actions (mint/burn)
    const events = [...mints, ...burnsNorm]
      .filter(e => e.now > 0 && e.address)
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);

    return res.status(200).json({
      ok: true,
      jetton_master: MASTER_FRIENDLY,
      jetton_master_raw: MASTER_RAW,
      decimals,
      total_supply: totalSupply,
      events,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
