export default async function handler(req, res) {
  try {
    const key = process.env.TONAPI_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });

    const r = await fetch("https://tonapi.io/v2/rates?tokens=ton&currencies=usd", {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
      cache: "no-store",
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.rates?.ton?.prices?.usd) {
      return res.status(502).json({ ok: false, error: "TonAPI rates failed", status: r.status, details: data });
    }

    const ton_onchain = Number(data.rates.ton.prices.usd);

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    return res.json({
      ok: true,
      ton_usdt_onchain: ton_onchain,
      source: "tonapi:/v2/rates",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
