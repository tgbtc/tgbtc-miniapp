export default async function handler(req, res) {
  try {
    const KEY = process.env.TONAPI_KEY;
    const MASTER = process.env.TGBTC_JETTON_MASTER;

    if (!KEY) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });
    if (!MASTER) return res.status(500).json({ ok: false, error: "TGBTC_JETTON_MASTER missing" });

    const r = await fetch(`https://tonapi.io/v2/jettons/${encodeURIComponent(MASTER)}`, {
      headers: { Authorization: `Bearer ${KEY}`, accept: "application/json" },
    });

    const txt = await r.text();
    let d = null;
    try { d = JSON.parse(txt); } catch {}

    if (!r.ok || !d) {
      return res.status(502).json({ ok: false, error: "TonAPI jetton fetch failed", status: r.status });
    }

    // TonAPI jetton object usually has: total_supply (string), decimals (number), metadata.symbol
    const totalSupplyRaw = d.total_supply;
    const decimals = Number(d.decimals ?? d.metadata?.decimals ?? 0);

    // convert to human
    const rawBig = BigInt(totalSupplyRaw || "0");
    const base = 10n ** BigInt(Math.max(0, decimals));
    const whole = rawBig / base;
    const frac = rawBig % base;

    // show up to 8 decimals for UI
    const fracStr = decimals > 0 ? frac.toString().padStart(decimals, "0").slice(0, 8) : "";
    const human = decimals > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.json({
      ok: true,
      symbol: (d.metadata?.symbol || "tgBTC"),
      decimals,
      total_supply_raw: totalSupplyRaw,
      total_supply: human,
      source: "tonapi(jettons)",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
