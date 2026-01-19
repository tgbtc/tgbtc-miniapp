export default async function handler(req, res) {
  try {
    // DexScreener pairId (из URL пары)
    const CHAIN = "ton";
    const PAIR_ID = "eqd8tj8xewb1spnre4d89yo3jl0w0eibnns4ibahaumdfize";

    async function getJSON(url) {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      const txt = await r.text();
      let data = null;
      try { data = JSON.parse(txt); } catch {}
      return { ok: r.ok, status: r.status, data, raw: txt };
    }

    // 1) Binance TONUSDT (server-side, без CORS)
let ton_binance = null;
try {
  const b = await getJSON("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT");
  const n = Number(b?.data?.price);
  if (Number.isFinite(n)) ton_binance = n;
} catch {}


    // 2) DexScreener pair
    // Документировано: /latest/dex/pairs/{chainId}/{pairId} :contentReference[oaicite:2]{index=2}
    const ds = await getJSON(`https://api.dexscreener.com/latest/dex/pairs/${CHAIN}/${PAIR_ID}`);

    if (!ds.ok || !ds.data) {
      return res.status(502).json({
        ok: false,
        error: "DexScreener pair fetch failed",
        details: { status: ds.status }
      });
    }

    // Обычно это { pairs: [ {...} ] }
    const pair = Array.isArray(ds.data?.pairs) ? ds.data.pairs[0] : ds.data?.pair ?? ds.data;

    const baseSym = (pair?.baseToken?.symbol || "").toUpperCase();
    const quoteSym = (pair?.quoteToken?.symbol || "").toUpperCase();

    const priceUsd = Number(pair?.priceUsd);         // цена BASE в USD
    const priceNative = Number(pair?.priceNative);   // цена BASE в QUOTE

    let ton_onchain = null;

    // Если TON — baseToken, то priceUsd = TON/USD
    if (baseSym === "TON" && Number.isFinite(priceUsd)) {
      ton_onchain = priceUsd;
    }

    // Если TON — quoteToken, а baseToken = USD₮ (или USD), то:
    // priceNative = 1 USD₮ в TON  =>  1 TON = 1 / priceNative USD₮ (~USD)
    if (!Number.isFinite(ton_onchain) && quoteSym === "TON" && Number.isFinite(priceNative) && priceNative > 0) {
      ton_onchain = 1 / priceNative;
    }

    // Фолбэк: если вдруг символы нестандартные, но base выглядит как USD
    if (!Number.isFinite(ton_onchain) && Number.isFinite(priceNative) && priceNative > 0) {
      const baseLooksUsd = baseSym.includes("USD") || baseSym.includes("USDT") || baseSym.includes("USD₮");
      if (baseLooksUsd) ton_onchain = 1 / priceNative;
    }

    if (!Number.isFinite(ton_onchain)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot compute TON price from DexScreener response",
        debug: { baseSym, quoteSym, priceUsd: pair?.priceUsd, priceNative: pair?.priceNative }
      });
    }

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");

    return res.json({
      ok: true,
      ton_usdt_binance: Number.isFinite(ton_binance) ? ton_binance : null,
      ton_usdt_stonfi: ton_onchain, // по смыслу: onchain DEX цена (STON.fi пул)
      source: "dexscreener",
      pairId: PAIR_ID
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
