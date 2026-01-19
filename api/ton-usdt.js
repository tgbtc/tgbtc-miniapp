export default async function handler(req, res) {
  try {
    // STON.fi USDt/TON pool (внешний адрес пула, по данным STON.fi / GeckoTerminal)
    const POOL = "EQD8TJ8xEWB1SpnRE4d89YO3jl0W0EiBnNS4IBaHaUmdfizE";

    // USDT jetton master (ты прислал)
    const USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

    // helper: безопасный fetch json
    async function getJSON(url) {
      const r = await fetch(url, { headers: { "accept": "application/json" } });
      const t = await r.text();
      let d;
      try { d = JSON.parse(t); } catch { d = null; }
      return { ok: r.ok, status: r.status, data: d, raw: t };
    }

    // 1) Binance TONUSDT
    const bin = await getJSON("https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT");
    const ton_binance = Number(bin?.data?.price);

    // 2) STON.fi pool data
    // Документированный эндпоинт: GET /v1/pools/{address} :contentReference[oaicite:2]{index=2}
    const poolResp = await getJSON(`https://api.ston.fi/v1/pools/${POOL}`);

    if (!poolResp.ok || !poolResp.data) {
      return res.status(502).json({
        ok: false,
        error: "STON.fi pool fetch failed",
        details: { status: poolResp.status }
      });
    }

    // У разных версий API поля могут называться по-разному — парсим максимально устойчиво
    const p = poolResp.data?.pool ?? poolResp.data; // иногда data.pool, иногда сразу объект

    // Попытки достать резервы (часто бывают reserve0/reserve1 или reserves)
    const reserve0 = p?.reserve0 ?? p?.reserves?.[0] ?? p?.reserves0 ?? p?.liquidity0 ?? null;
    const reserve1 = p?.reserve1 ?? p?.reserves?.[1] ?? p?.reserves1 ?? p?.liquidity1 ?? null;

    // Активы пула (asset0/asset1)
    const a0 = p?.asset0 ?? p?.token0 ?? p?.assets?.[0] ?? null;
    const a1 = p?.asset1 ?? p?.token1 ?? p?.assets?.[1] ?? null;

    // Находим где USDT, где TON
    // Иногда адрес лежит в a.address, иногда в a.contract_address, иногда в a.meta.address
    function getAddr(a){
      return a?.address ?? a?.contract_address ?? a?.meta?.address ?? null;
    }
    function getDecimals(a){
      const d = a?.decimals ?? a?.meta?.decimals ?? null;
      return d == null ? null : Number(d);
    }
    function getSymbol(a){
      return (a?.symbol ?? a?.meta?.symbol ?? "").toString();
    }

    const addr0 = getAddr(a0);
    const addr1 = getAddr(a1);

    // fallback decimals: TON=9, USDT=6
    const dec0 = getDecimals(a0);
    const dec1 = getDecimals(a1);

    // превращаем резерв в число (строка/число)
    function toNum(x){
      if (x == null) return null;
      if (typeof x === "number") return x;
      if (typeof x === "string") return Number(x);
      return Number(x);
    }

    const r0 = toNum(reserve0);
    const r1 = toNum(reserve1);

    if (!Number.isFinite(r0) || !Number.isFinite(r1)) {
      return res.status(502).json({
        ok: false,
        error: "Cannot parse pool reserves",
        hint: "API fields may differ; open /api/ton-usdt to see raw fields",
      });
    }

    // Определяем стороны пула
    const sym0 = getSymbol(a0);
    const sym1 = getSymbol(a1);

    const isUSDT0 = (addr0 === USDT_MASTER) || sym0.includes("USD");
    const isUSDT1 = (addr1 === USDT_MASTER) || sym1.includes("USD");

    // В STON API резервы обычно в “минимальных единицах”, поэтому делим на 10^decimals
    // Если вдруг резервы уже “человеческие” — итог будет странный; тогда ты скажешь, и мы подстроим.
    function norm(amount, decimals){
      const d = Number.isFinite(decimals) ? decimals : 0;
      return amount / Math.pow(10, d);
    }

    // Пытаемся посчитать цену TON в USDT: USDT_reserve / TON_reserve
    let ton_ston = null;

    if (isUSDT0 && !isUSDT1) {
      const usdt = norm(r0, Number.isFinite(dec0) ? dec0 : 6);
      const ton  = norm(r1, Number.isFinite(dec1) ? dec1 : 9);
      ton_ston = usdt / ton;
    } else if (isUSDT1 && !isUSDT0) {
      const usdt = norm(r1, Number.isFinite(dec1) ? dec1 : 6);
      const ton  = norm(r0, Number.isFinite(dec0) ? dec0 : 9);
      ton_ston = usdt / ton;
    } else {
      // Не смогли понять — вернём инфо для отладки
      return res.status(502).json({
        ok: false,
        error: "Cannot identify USDT side in pool",
        debug: { addr0, addr1, sym0, sym1 }
      });
    }

    // лёгкий кэш
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");

    return res.json({
      ok: true,
      ton_usdt_binance: Number.isFinite(ton_binance) ? ton_binance : null,
      ton_usdt_stonfi: Number.isFinite(ton_ston) ? ton_ston : null,
      pool: POOL
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
