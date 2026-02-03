export default async function handler(req, res) {
  try {
    const JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(JETTON_MASTER)}`;

    const mintsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/mints?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=10&sort=desc`;

    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=10&sort=desc`;

    const [supplyRes, mintsRes, burnsRes] = await Promise.all([
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(mintsUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const supplyJson = await supplyRes.json();
    const mintsJson = await mintsRes.json();
    const burnsJson = await burnsRes.json();

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "Supply error", raw: supplyJson });
    }

    const r = supplyJson.result;
    const decimals =
      Number(
        r?.jetton_content?.data?.decimals ??
        r?.jetton_content?.decimals ??
        "0"
      );

    const totalSupply = String(r.total_supply);

    // ✅ Mint token events
    const mints = Array.isArray(mintsJson?.jetton_mints)
      ? mintsJson.jetton_mints.map(m => ({
          type: "MINT",
          now: Number(m.transaction_now || 0),
          address: String(m.receiver || ""), // кто получил tgBTC
          amount: String(m.amount || "0"),
          tx_hash: String(m.transaction_hash || ""),
        }))
      : [];

    // ✅ Burn token events
    const burns = Array.isArray(burnsJson?.jetton_burns)
      ? burnsJson.jetton_burns.map(b => ({
          type: "BURN",
          now: Number(b.transaction_now || 0),
          address: String(b.owner || ""), // кто сжёг
          amount: String(b.amount || "0"),
          tx_hash: String(b.transaction_hash || ""),
        }))
      : [];

    // объединяем и берём последние 3
    const events = [...mints, ...burns]
      .filter(e => e.now > 0 && e.address)
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);

    return res.status(200).json({
      ok: true,
      jetton_master: JETTON_MASTER,
      decimals,
      total_supply: totalSupply,
      events,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
