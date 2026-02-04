// api/track.js
export default async function handler(req, res) {
  try {
    const MASTER_FRIENDLY = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY missing" });
    }

    const headers = { accept: "application/json", "X-API-Key": API_KEY };

    // --- helpers: friendly/raw packing ---
    const packCache = new Map();

    async function packToFriendly(rawAddr) {
      if (!rawAddr) return "";
      const key = String(rawAddr);
      if (packCache.has(key)) return packCache.get(key);

      // TON Center v2: packAddress turns "0:..." into user-friendly "EQ..."/"UQ..."/"0Q..."
      const url =
        `https://testnet.toncenter.com/api/v2/packAddress?address=${encodeURIComponent(key)}`;

      const r = await fetch(url, { headers, cache: "no-store" });
      const j = await r.json().catch(() => null);

      // if packAddress fails, fallback to raw
      const out =
        (r.ok && j && j.ok === true && typeof j.result === "string") ? j.result : key;

      packCache.set(key, out);
      return out;
    }

    // 0) friendly -> raw (for info/debug)
    const unpackUrl =
      `https://testnet.toncenter.com/api/v2/unpackAddress?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 1) supply
    const supplyUrl =
      `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(MASTER_FRIENDLY)}`;

    // 2) actions (to try to detect MINT events like tonviewer)
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
    const supplyJson = await supplyRes.json();
    const actionsJson = await actionsRes.json();
    const burnsJson = await burnsRes.json();

    if (!unpackRes.ok || unpackJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "unpackAddress error", raw: unpackJson });
    }
    const MASTER_RAW = String(unpackJson.result); // 0:...

    if (!supplyRes.ok || supplyJson.ok !== true) {
      return res.status(502).json({ ok: false, error: "Supply error", raw: supplyJson });
    }

    // decimals + supply
    const r = supplyJson.result;
    const decimals =
      Number(r?.jetton_content?.data?.decimals ?? r?.jetton_content?.decimals ?? "0");
    const totalSupply = String(r.total_supply);

    // ---- Extract MINT from actions (best-effort) ----
    const actions = Array.isArray(actionsJson?.actions) ? actionsJson.actions : [];
    const toLower = (v) => String(v ?? "").toLowerCase();

    function pickAmount(details) {
      return String(details?.amount ?? details?.jetton_amount ?? details?.quantity ?? details?.value ?? "0");
    }
    function pickReceiver(details) {
      return String(details?.receiver ?? details?.destination ?? details?.to ?? details?.recipient ?? details?.account ?? "");
    }
    function pickUtime(action, details) {
      return Number(action?.start_utime ?? action?.end_utime ?? details?.utime ?? details?.transaction_now ?? 0);
    }
    function pickHash(action, details) {
      return String(action?.trace_external_hash_norm ?? action?.trace_external_hash ?? details?.transaction_hash ?? "");
    }

    const mintsRaw = actions
      .map(a => {
        const d = a?.details || null;
        if (!d) return null;

        const t = toLower(d.type || d.action || d.name || a.type || a.action || a.name);
        // variants like: jetton_mint / jetton mint / mint jetton ...
        const looksMint = t.includes("mint") && t.includes("jetton");
        if (!looksMint) return null;

        const receiver = pickReceiver(d);
        if (!receiver) return null;

        return {
          type: "MINT",
          now: pickUtime(a, d),
          address_raw: receiver,
          amount: pickAmount(d),
          tx_hash: pickHash(a, d),
        };
      })
      .filter(Boolean)
      .filter(e => e.now > 0 && e.address_raw);

    // ---- Extract BURN from burns endpoint (exact) ----
    const burns = Array.isArray(burnsJson?.jetton_burns) ? burnsJson.jetton_burns : [];
    const burnsRaw = burns
      .filter(b => b && b.transaction_aborted !== true)
      .map(b => ({
        type: "BURN",
        now: Number(b.transaction_now || 0),
        address_raw: String(b.owner || ""),
        amount: String(b.amount || "0"),
        tx_hash: String(b.transaction_hash || ""),
      }))
      .filter(e => e.now > 0 && e.address_raw);

    // merge and take last 3 by time
    const merged = [...mintsRaw, ...burnsRaw]
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);

    // ✅ convert addresses to friendly like "0Q..."
    const events = await Promise.all(
      merged.map(async (e) => ({
        ...e,
        address: await packToFriendly(e.address_raw),
      }))
    );

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
