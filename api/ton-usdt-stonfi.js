export default async function handler(req, res) {
  try {
    const CHAIN = "ton";
    const PAIR = process.env.STONFI_PAIR_ADDRESS; // EQ...

    if (!PAIR) {
      return res.status(500).json({ ok: false, error: "STONFI_PAIR_ADDRESS missing" });
    }

    const url = `https://api.dexscreener.com/latest/dex/pairs/${CHAIN}/${PAIR}`;

    const r = await fetch(url, { headers: { accept: "application/json" } });
    const txt = await r.text();
    let data = null;
    try { data = JSON.parse(txt); } catch {}

    if (!r.ok || !data) {
      return res.status(502).json({ ok: false, error: "DexScreener fetch failed", status: r.status });
    }

    const pair = Array.isArray(data?.pairs) ? data.pairs[0] : (data?.pair ?? data);
    const baseSym = String(pair?.baseToken?.symbol || "").toUpperCase();
    const quoteSym = String(pair?.quoteToken?.symbol || "").toUpperCase();

    const priceUsd = Number(pair?.priceUsd);
    const priceNative = Number(pair?.priceNative);

    let ton_usdt = null;

    // Если TON — baseToken => priceUsd это TON/USD
    if (baseSym === "TON" && Number.isFinite(priceUsd)) ton_usdt = priceUsd;

    // Если TON — quoteToken (base USDT) => priceNative = 1 USDT в TON => 1 TON = 1/priceNative USD
    if (!Number.isFinite(ton_usdt) && quoteSym === "TON" && Number.isFinite(priceNative) && priceNative > 0) {
      ton_usdt = 1 / priceNative;
    }

    if (!Number.isFinite(ton_usdt)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot compute TON/USDT from DexScreener",
        debug: { baseSym, quoteSym, priceUsd: pair?.priceUsd, priceNative: pair?.priceNative }
      });
    }

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    return res.json({ ok: true, dex: "stonfi", price: ton_usdt, pair: PAIR });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
