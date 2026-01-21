export default async function handler(req, res) {
  try {
    const KEY = process.env.TONAPI_KEY;
    if (!KEY) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });

    async function get(url) {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${KEY}`, accept: "application/json" },
      });
      const txt = await r.text();
      let data = null;
      try { data = JSON.parse(txt); } catch {}
      return { ok: r.ok, status: r.status, data, raw: txt };
    }

    // 1) Onchain (DEX-based) price from Rates
    // Docs: /v2/rates (getRates) :contentReference[oaicite:0]{index=0}
    const onchainResp = await get("https://tonapi.io/v2/rates?tokens=ton&currencies=usd");

    // 2) Markets (market-based) price
    // Docs: /v2/rates/markets (getMarketsRates) :contentReference[oaicite:1]{index=1}
    const marketsResp = await get("https://tonapi.io/v2/rates/markets?currency=usd");

    function pickNumberDeep(obj) {
      if (obj == null) return null;
      if (typeof obj === "number" && Number.isFinite(obj)) return obj;
      if (typeof obj === "string") {
        const n = Number(obj);
        if (Number.isFinite(n)) return n;
      }
      if (typeof obj !== "object") return null;

      // common keys we try first
      const keys = [
        "price", "value", "rate", "usd", "USD", "ton_usd", "price_usd", "priceUsd",
        "market_price", "markets_price", "close", "last", "mean"
      ];

      for (const k of keys) {
        if (k in obj) {
          const n = pickNumberDeep(obj[k]);
          if (Number.isFinite(n)) return n;
        }
      }
      // search recursively (bounded)
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const n = pickNumberDeep(v);
        if (Number.isFinite(n)) return n;
      }
      return null;
    }

    // Onchain parsing (TonAPI responses can vary; we extract any reasonable numeric USD)
    let onchainUsd = null;
    if (onchainResp.ok && onchainResp.data) {
      // Usually something like data.rates.ton.prices.usd or similar.
      onchainUsd = pickNumberDeep(onchainResp.data);
    }

    // Markets parsing
    let marketsUsd = null;
    if (marketsResp.ok && marketsResp.data) {
      marketsUsd = pickNumberDeep(marketsResp.data);
    }

    // Hard fail if both missing
    if (!Number.isFinite(onchainUsd) && !Number.isFinite(marketsUsd)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot parse TON prices from TonAPI",
        debug: {
          onchain_status: onchainResp.status,
          markets_status: marketsResp.status,
          onchain_sample: onchainResp.data ? Object.keys(onchainResp.data) : null,
          markets_sample: marketsResp.data ? Object.keys(marketsResp.data) : null,
        },
      });
    }

    // Spread calc (markets - onchain)
    const spreadAbs = (Number.isFinite(marketsUsd) && Number.isFinite(onchainUsd))
      ? (marketsUsd - onchainUsd)
      : null;

    const spreadPct = (spreadAbs != null && Number.isFinite(onchainUsd) && onchainUsd > 0)
      ? (spreadAbs / onchainUsd) * 100
      : null;

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    return res.json({
      ok: true,
      onchain_usd: Number.isFinite(onchainUsd) ? onchainUsd : null,
      markets_usd: Number.isFinite(marketsUsd) ? marketsUsd : null,
      spread_abs_usd: Number.isFinite(spreadAbs) ? spreadAbs : null,
      spread_pct: Numb_
