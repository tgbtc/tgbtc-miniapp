export default async function handler(req, res) {
  try {
    // Это pool адрес пары USD₮ / TON (его видно даже на DexScreener, и он совпадает с вашим)
    // EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE
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

    // 2) STON.fi onchain через export dexscreener pair endpoint
    // Документировано у STON.fi: /export/dexscreener/v1/pair/{address} :contentReference[oaicite:1]{index=1}
    const st = await getJSON(`https://api.ston.fi/export/dexscreener/v1/pair/${POOL}`);

    if (!st.ok || !st.data) {
      return res.status(502).json({
        ok: false,
        error: "STON.fi export pair fetch failed",
        details: { status: st.status }
      });
    }

    // --- Универсальный поиск TON priceUsd в любом формате ответа ---
    function findTonPriceUsd(node) {
      if (!node) return null;

      // Если массив — ищем внутри
      if (Array.isArray(node)) {
        for (const x of node) {
          const v = findTonPriceUsd(x);
          if (Number.isFinite(v)) return v;
        }
        return null;
      }

      // Если объект — проверяем, не токен ли это
      if (typeof node === "object") {
        const sym = (node.symbol || node.baseToken?.symbol || node.quoteToken?.symbol || "").toString().toUpperCase();

        // Часто TON лежит как token {symbol:"TON", priceUsd:"..."} или baseToken/quoteToken
        const priceUsd =
          node.priceUsd ?? node.price_usd ??
          node.baseToken?.priceUsd ?? node.baseToken?.price_usd ??
          node.quoteToken?.priceUsd ?? node.quoteToken?.price_usd;

        if (sym === "TON" && priceUsd != null) {
