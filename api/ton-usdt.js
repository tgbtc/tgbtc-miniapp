export default async function handler(req, res) {
  try {
    // ВАЖНО: сюда нужен TON-адрес пула в формате EQ...
    // (не lower-case, не “pairId”)
    const POOL = "EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE";

    async function getJSON(url) {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      const txt = await r.text();
      let data = null;
      try { data = JSON.parse(txt); } catch {}
      return { ok: r.ok, status: r.status, data, raw: txt };
    }

    // 1) Binance TONUSDT
    const bin = await getJSON("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT");
    const ton_binance = Number(bin?.data?.price);

    // 2) STON.fi export (DexScreener format)
    const stUrl = `https://api.ston.fi/export/dexscreener/v1/pair/${encodeURIComponent(POOL)}`;
    const st = await getJSON(stUrl);

    if (!st.ok || !st.data) {
      return res.status(502).json({
        ok: false,
        error: "STON.fi export pair fetch failed",
        details: { status: st.status }
      });
    }

    // Ответ обычно либо { pair: {...} }, либо сразу объект пары
    const pair = st.data?.pair ?? st.data;

    const baseSym  = (pair?.baseToken?.symbol  || "").toString().toUpperCase();
    const quoteSym = (pair?.quoteToken?.symbol || "").toString().toUpperCase();

    // priceUsd = цена baseToken в USD
    // priceNative = цена baseToken в quoteToken
    const priceUsd = Number(pair?.priceUsd);
    const priceNative = Number(pair?.priceNative);

    let ton_stonfi = null;

    // Сценарий A: baseToken = TON => priceUsd уже TON/USD
    if (baseSym === "TON" && Number.isFinite(priceUsd)) {
      ton_stonfi = priceUsd;
    }

    // Сценарий B: quoteToken = TON, baseToken = USD₮ => 1 USD₮ = X TON (priceNative)
    // тогда 1 TON = 1/X USD₮ ~ 1/X USD
    if (!Number.isFinite(ton_stonfi) && quoteSym === "TON" && Number.isFinite(priceNative) && priceNative > 0) {
      ton_stonfi = 1 / priceNative;
    }

    // Фолбэк: если baseToken похож на USD/USDT — всё равно инверсия
    if (!Number.isFinite(ton_stonfi) && Number.isFinite(priceNative) && priceNative > 0) {
      const baseLooksUsd = baseSym.includes("USD") || baseSym.includes("USDT") || baseSym.includes("USD₮");
      if (baseLooksUsd) ton_stonfi = 1 / priceNative;
    }

    if (!Number.isFinite(ton_stonfi)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot parse TON price from STON.fi export response",
        debug: { baseSym, quoteSym, priceUsd: pair?.priceUsd, priceNative: pair?.priceNative }
      });
    }

    // лёгкий кэш
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");

    return res.json({
      ok: true,
      ton_usdt_binance: Number.isFinite(ton_binance) ? ton_binance : null,
      ton_usdt_stonfi: ton_stonfi,
      pool: POOL
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
