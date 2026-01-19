export default async function handler(req, res) {
  try {
    // Пара USD₮/TON на STON.fi (адрес пары как на DexScreener)
    // https://dexscreener.com/ton/eqd8tj8xewb1spnre4d89yo3jl0w0eibnns4ibahaumdfize
    const PAIR = "eqd8tj8xewb1spnre4d89yo3jl0w0eibnns4ibahaumdfize";

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

    // 2) STON.fi export (DexScreener-like)
    const st = await getJSON(`https://api.ston.fi/export/dexscreener/v1/pair/${PAIR}`);

    if (!st.ok || !st.data) {
      return res.status(502).json({
        ok: false,
        error: "STON.fi export pair fetch failed",
        details: { status: st.status }
      });
    }

    // Обычно ответ либо { pair: {...} }, либо сразу объект пары
    const pair = st.data?.pair ?? st.data;

    const baseSym = (pair?.baseToken?.symbol || "").toString().toUpperCase();
    const quoteSym = (pair?.quoteToken?.symbol || "").toString().toUpperCase();

    const priceUsd = Number(pair?.priceUsd);       // цена baseToken в USD
    const priceNative = Number(pair?.priceNative); // цена baseToken в quoteToken

    let ton_stonfi = null;

    // Сценарий A: TON — baseToken => priceUsd уже TON/USD
    if (baseSym === "TON") {
      if (Number.isFinite(priceUsd)) ton_stonfi = priceUsd;
    }

    // Сценарий B: TON — quoteToken, baseToken — USDt => TON/USD = 1 / (USDt in TON)
    // priceNative = baseToken в quoteToken => 1 USDt = X TON => 1 TON = 1/X USDt ~ 1/X USD
    if (!Number.isFinite(ton_stonfi) && quoteSym === "TON") {
      if (Number.isFinite(priceNative) && priceNative > 0) {
        ton_stonfi = 1 / priceNative;
      }
    }

    // Фолбэк (если порядок токенов вдруг другой)
    // Если baseToken — USD/USDT и priceNative = USD in TON, всё равно работает (инверсия)
    if (!Number.isFinite(ton_stonfi) && Number.isFinite(priceNative) && priceNative > 0) {
      if (baseSym.includes("USD") || baseSym.includes("USDT") || baseSym.includes("USD₮")) {
        ton_stonfi = 1 / priceNative;
      }
    }

    if (!Number.isFinite(ton_stonfi)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot parse TON price from STON.fi export response",
        debug: { baseSym, quoteSym, priceUsd: pair?.priceUsd, priceNative: pair?.priceNative }
      });
    }

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");

    return res.json({
      ok: true,
      ton_usdt_binance: Number.isFinite(ton_binance) ? ton_binance : null,
      ton_usdt_stonfi: ton_stonfi,
      pair: PAIR
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
