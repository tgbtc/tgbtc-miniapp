export default async function handler(req, res) {
  try {
    const KEY = process.env.TONAPI_KEY;
    const MASTER = process.env.TGBTC_JETTON_MASTER;
    if (!KEY || !MASTER) {
      return res.status(500).json({ ok:false, error:"env missing" });
    }

    const r = await fetch(`https://tonapi.io/v2/jettons/${MASTER}`, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    const d = await r.json();

    const raw = BigInt(d.total_supply || "0");
    const decimals = Number(d.decimals || 0);
    const base = 10n ** BigInt(decimals);

    const whole = raw / base;
    const frac = raw % base;

    const supply =
      decimals > 0
        ? `${whole}.${frac.toString().padStart(decimals,"0").slice(0,8)}`
        : whole.toString();

    res.json({ ok:true, supply });
  } catch(e){
    res.status(500).json({ ok:false, error:String(e) });
  }
}
