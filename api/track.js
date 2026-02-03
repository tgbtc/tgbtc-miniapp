export default async function handler(req, res) {
  try {
    const JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // Supply (v2) — самый простой способ взять total_supply + decimals
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(JETTON_MASTER)}`;

    // Mint candidates: jetton transfers where source == jetton_master
    // response fields: amount, destination, source, transaction_now, transaction_aborted... :contentReference[oaicite:2]{index=2}
    const transfersUrl =
      `https://testnet.toncenter.com/api/v3/jetton/transfers?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=80&sort=desc`;

    // Burn events: jetton burns with owner, amount, transaction_now... :contentReference[oaicite:3]{index=3}
    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(JETTON_MASTER)}&limit=80&sort=desc`;

    const [supplyRes, transfersRes, burnsRes] = await Promise.all([
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(transfersUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const supplyText = await supplyRes.text();
    const transfersText = await transfersRes.text();
    const burnsText = await burnsRes.text();

    let supplyJson, transfersJson, burnsJson;
    try { supplyJson = JSON.parse(supplyText); } catch {
      return res.status(502).json({ ok:false, error:"Supply non-json", raw:supplyText.slice(0,400) });
    }
    try { transfersJson = JSON.parse(transfersText); } catch {
      return res.status(502).json({ ok:false, error:"Transfers non-json", raw:transfersText.slice(0,400) });
    }
    try { burnsJson = JSON.parse(burnsText); } catch {
      return res.status(502).json({ ok:false, error:"Burns non-json", raw:burnsText.slice(0,400) });
    }

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok:false, error:"Supply error", raw:supplyJson });
    }

    const r = supplyJson.result;
    const decimalsStr =
      r?.jetton_content?.data?.decimals ??
      r?.jetton_content?.decimals ??
      "0";

    const decimals = Number(decimalsStr);
    const totalSupply = String(r.total_supply);

// Mint token (как в tonviewer):
// transfer where mint=true OR source is null/empty
const transfers = Array.isArray(transfersJson?.jetton_transfers)
  ? transfersJson.jetton_transfers
  : [];

const mints = transfers
  .filter(t => t && t.transaction_aborted !== true)
  .filter(t =>
    t.is_mint === true ||        // если поле есть
    !t.source || t.source === "" // или source отсутствует
  )
  .map(t => ({
    type: "MINT",
    now: Number(t.transaction_now || 0),
    address: String(t.destination || ""), // кто получил tgBTC
    amount: String(t.amount || "0"),
    tx_hash: String(t.transaction_hash || ""),
  }));


    const burnsNorm = burns
      .filter(b => b && b.transaction_aborted !== true)
      .map(b => ({
        type: "BURN",
        now: Number(b.transaction_now || 0),
        address: String(b.owner || ""),        // who burned
        amount: String(b.amount || "0"),
        tx_hash: String(b.transaction_hash || ""),
      }));

    // merge, sort by time desc, keep only MINT/BURN, take 3
    const events = [...mints, ...burnsNorm]
      .filter(e => e.now > 0 && e.address)
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);

    return res.status(200).json({
      ok: true,
      jetton_master: JETTON_MASTER,
      decimals,
      total_supply: totalSupply,
      events
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
