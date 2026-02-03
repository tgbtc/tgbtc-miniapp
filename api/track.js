export default async function handler(req, res) {
  try {
    const MASTER_FRIENDLY = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;
    if (!API_KEY) return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // 0) friendly -> raw
    const unpackUrl =
      `https://testnet.toncenter.com/api/v2/unpackAddress?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    const unpackRes = await fetch(unpackUrl, { headers, cache: "no-store" });
    const unpackJson = await unpackRes.json();
    if (!unpackRes.ok || unpackJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "unpackAddress error", raw: unpackJson });
    }
    const MASTER_RAW = String(unpackJson.result); // 0:...

    // 1) supply
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 2) get master jetton-wallet (IMPORTANT: use RAW)
    const masterWalletUrl =
      `https://testnet.toncenter.com/api/v3/jetton/wallets?owner_address=${encodeURIComponent(MASTER_RAW)}&jetton_address=${encodeURIComponent(MASTER_RAW)}&limit=1`;

    // 3) transfers + burns
    const transfersUrl =
      `https://testnet.toncenter.com/api/v3/jetton/transfers?jetton_master=${encodeURIComponent(MASTER_FRIENDLY)}&limit=250&sort=desc`;

    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(MASTER_FRIENDLY)}&limit=80&sort=desc`;

    const [supplyRes, masterWalletRes, transfersRes, burnsRes] = await Promise.all([
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(masterWalletUrl, { headers, cache: "no-store" }),
      fetch(transfersUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const supplyJson = await supplyRes.json();
    const masterWalletJson = await masterWalletRes.json();
    const transfersJson = await transfersRes.json();
    const burnsJson = await burnsRes.json();

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "Supply error", raw: supplyJson });
    }

    const r = supplyJson.result;
    const decimals =
      Number(r?.jetton_content?.data?.decimals ?? r?.jetton_content?.decimals ?? "0");
    const totalSupply = String(r.total_supply);

    const MASTER_JETTON_WALLET =
      Array.isArray(masterWalletJson?.jetton_wallets) && masterWalletJson.jetton_wallets[0]?.address
        ? String(masterWalletJson.jetton_wallets[0].address)
        : null;

    const transfers = Array.isArray(transfersJson?.jetton_transfers) ? transfersJson.jetton_transfers : [];
    const burns = Array.isArray(burnsJson?.jetton_burns) ? burnsJson.jetton_burns : [];

    // ✅ MINT = transfer FROM master jetton-wallet (как в tonviewer "tgBTC -> адрес")
    const mints = transfers
      .filter(t => t && t.transaction_aborted !== true)
      .filter(t => {
        const sw = String(t.source_wallet || "");
        const so = String(t.source || "");
        return (
          (MASTER_JETTON_WALLET && sw === MASTER_JETTON_WALLET) ||
          so === MASTER_RAW
        );
      })
      .map(t => ({
        type: "MINT",
        now: Number(t.transaction_now || 0),
        address: String(t.destination || ""), // кто получил tgBTC
        amount: String(t.amount || "0"),
        tx_hash: String(t.transaction_hash || ""),
      }));

    // ✅ BURN
    const burnsNorm = burns
      .filter(b => b && b.transaction_aborted !== true)
      .map(b => ({
        type: "BURN",
        now: Number(b.transaction_now || 0),
        address: String(b.owner || ""), // кто сжёг
        amount: String(b.amount || "0"),
        tx_hash: String(b.transaction_hash || ""),
      }));

    const events = [...mints, ...burnsNorm]
      .filter(e => e.now > 0 && e.address)
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);

    return res.status(200).json({
      ok: true,
      jetton_master: MASTER_FRIENDLY,
      jetton_master_raw: MASTER_RAW,
      master_jetton_wallet: MASTER_JETTON_WALLET,
      decimals,
      total_supply: totalSupply,
      events,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
