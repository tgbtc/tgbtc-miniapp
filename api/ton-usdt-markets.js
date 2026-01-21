export default async function handler(req, res) {
  try {
    const key = process.env.TONAPI_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });

    const r = await fetch("https://tonapi.io/v2/rates/markets", {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
      cache: "no-store",
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(data?.markets)) {
      return res.status(502).json({ ok: false, error: "TonAPI markets failed", status: r.status, details: data });
    }

    // Берём среднюю/референсную (часто в списке есть агрегированная),
    // но на всякий случай: возьмём первую с валидной ценой usd
    const m = data.markets.find(x => Number.isFinite(Number(x?.price_usd ?? x?.usd ?? x?.priceUsd)));
    const price = Number(m?.price_usd ?? m?.usd ?? m?.priceUsd);

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    return res.json({
      ok: true,
      ton_usdt_markets: price,
      source: "tonapi:/v2/rates/markets",
      market: m?.market ?? m?.name ?? null
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
