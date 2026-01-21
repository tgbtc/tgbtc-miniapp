export default async function handler(req, res) {
  try {
    const KEY = process.env.TONAPI_KEY;
    const MASTER = process.env.TGBTC_JETTON_MASTER;

    if (!KEY) return res.status(500).json({ ok:false, error:"TONAPI_KEY missing" });
    if (!MASTER) return res.status(500).json({ ok:false, error:"TGBTC_JETTON_MASTER missing" });

    const url = `https://tonapi.io/v2/jettons/${encodeURIComponent(MASTER)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${KEY}`, accept: "application/json" },
    });

    const txt = await r.text();
    let d = null;
    try { d = JSON.parse(txt); } catch {}

    if (!r.ok || !d) {
      return res.status(502).json({
        ok:false,
        error:"TonAPI jetton fetch failed",
        status:r.status,
        used_master: MASTER,
        url
      });
    }

    const totalSupplyRawStr = String(d.total_supply ?? "0");
    let raw = 0n;
    try { raw = BigInt(totalSupplyRawStr); } catch {}

    const decimals = Number(d.decimals ?? d.metadata?.decimals ?? 0);
    const symbol = d.metadata?.symbol || "tgBTC";

    const base = 10n ** BigInt(Math.max(0, decimals));
    const whole = raw / base;
    const frac = raw % base;

    const fracStr = decimals > 0
      ? frac.toString().padStart(decimals, "0").slice(0, 8)
      : "";

    const supply = decimals > 0 ? `${whole}.${fracStr}` : whole.toString();

    return res.json({
      ok: true,
      symbol,
      decimals,
      total_supply_raw: totalSupplyRawStr,
      supply,
      used_master: MASTER
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
}
