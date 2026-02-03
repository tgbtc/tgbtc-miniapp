// api/track.js
export default async function handler(req, res) {
  try {
    const MASTER_FRIENDLY = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // 0) friendly -> raw
    const unpackUrl =
      `https://testnet.toncenter.com/api/v2/unpackAddress?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 1) supply
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 2) actions of master (TON Center indexer)
    const actionsUrl =
      `https://testnet.toncenter.com/api/v3/actions?account=${encodeURIComponent(MASTER_FRIENDLY)}&limit=200&sort=desc`;

    // 3) burns
    const burnsUrl =
      `https://testnet.toncenter.com/api/v3/jetton/burns?jetton_master=${encodeURIComponent(MASTER_FRIENDLY)}&limit=200&sort=desc`;

    const [unpackRes, supplyRes, actionsRes, burnsRes] = await Promise.all([
      fetch(unpackUrl, { headers, cache: "no-store" }),
      fetch(supplyUrl, { headers, cache: "no-store" }),
      fetch(actionsUrl, { headers, cache: "no-store" }),
      fetch(burnsUrl, { headers, cache: "no-store" }),
    ]);

    const unpackJson = await unpackRes.json();
    if (!unpackRes.ok || unpackJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "unpackAddress error", raw: unpackJson });
    }
    const MASTER_RAW = String(unpackJson.result); // 0:...

    const supplyJson = await supplyRes.json();
    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "Supply error", raw: supplyJson });
    }

    const actionsJson = await actionsRes.json();
    const burnsJson = await burnsRes.json();

    // decimals + supply
    const r = supplyJson.result;
    const decimals =
      Number(r?.jetton_content?.data?.decimals ?? r?.jetton_content?.decimals ?? "0");
    const totalSupply = String(r.total_supply);

    // ---- helpers for actions -> mint extraction ----
    const actions = Array.isArray(actionsJson?.actions) ? actionsJson.actions : [];

    const toLower = (v) => String(v ?? "").toLowerCase();

    function isThisJetton(details) {
      // Some variants that may exist in TON Center payloads
      const jm = String(
        details?.jetton_master ??
        details?.jetton ??
        details?.jetton_address ??
        details?.master ??
        details?.jettonMaster ??
        ""
      );
      return jm === MASTER_RAW || jm === MASTER_FRIENDLY;
    }

    function pickAmount(details) {
      return String(
        details?.amount ??
        details?.jetton_amount ??
        details?.quantity ??
        details?.value ??
        "0"
      );
    }

    function pickReceiver(details) {
      return String(
        details?.receiver ??
        details?.destination ??
        details?.to ??
        details?.recipient ??
        details?.account ??
        ""
      );
    }

    function pickUtime(action, details) {
      return Number(
        action?.start_utime ??
        action?.end_utime ??
        details?.utime ??
        details?.transaction_now ??
        0
      );
    }

    function pickHash(action, details) {
      return String(
        action?.trace_external_hash_norm ??
        action?.trace_external_hash ??
        details?.transaction_hash ??
        ""
      );
    }

    // ✅ MINT from actions (try multiple "type" encodings)
    const mints = actions
      .map(a => {
        const d = a?.details || null;
        if (!d) return null;

        const t = toLower(d.type || d.action || d.name || a.type || a.action || a.name);
        // typical variants we might see:
        // "jetton_mint", "mint_jetton", "jetton mint", etc
        const looksMint = t.includes("mint") && t.includes("jetton");
        if (!looksMint) return null;

        // If jetton identity exists, require it to match tgBTC master
        // If not present, keep it (some indexers omit it for master actions)
        const hasJettonId =
          d?.jetton_master || d?.jetton || d?.jetton_address || d?.master || d?.jettonMaster;
        if (hasJettonId && !isThisJetton(d)) return null;

        const receiver = pickReceiver(d);
        if (!receiver) return null;

        return {
          type: "MINT",
          now: pickUtime(a, d),
          address: receiver,            // who received tgBTC
          amount: pickAmount(d),
          tx_hash: pickHash(a, d),
        };
      })
      .filter(Boolean)
      .filter(e => e.now > 0);

    // ✅ BURN from /jetton/burns (works already)
    const burns = Array.isArray(burnsJson?.jetton_burns) ? burnsJson.jetton_burns : [];
    const burnsNorm = burns
      .filter(b => b && b.transaction_aborted !== true)
      .map(b => ({
        type: "BURN",
        now: Number(b.transaction_now || 0),
        address: String(b.owner || ""),       // who burned
        amount: String(b.amount || "0"),
        tx_hash: String(b.transaction_hash || ""),
      }))
      .filter(e => e.now > 0 && e.address);

    // last 3 actions total
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
      // Uncomment for debugging if needed:
      // debug_actions_types: actions.slice(0, 20).map(a => (a?.details?.type || a?.type || null)).filter(Boolean),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
