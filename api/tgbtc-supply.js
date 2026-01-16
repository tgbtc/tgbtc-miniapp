// Vercel Serverless Function: /api/tgbtc-supply
// Работает даже если у тебя проект "просто index.html"

const JETTON_MASTER = "EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU";
const DECIMALS = 8;

function pickTotalSupply(stack) {
  const first = stack?.[0];
  if (!Array.isArray(first) || first[0] !== "num") return null;
  const v = String(first[1]);
  return (v.startsWith("0x") || v.startsWith("0X"))
    ? BigInt(v).toString()
    : BigInt(v).toString();
}

function formatJetton(rawStr, decimals) {
  const raw = BigInt(rawStr);
  const base = 10n ** BigInt(decimals);
  const i = raw / base;
  const f = raw % base;

  const intStr = i.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let frac = f.toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${intStr}.${frac}` : intStr;
}

export default async function handler(req, res) {
  try {
    const key = process.env.TONCENTER_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "Missing TONCENTER_API_KEY" });

    const r = await fetch("https://toncenter.com/api/v2/runGetMethod", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        address: JETTON_MASTER,
        method: "get_jetton_data",
        stack: []
      }),
    });

    const d = await r.json();
    if (!d?.ok) return res.status(502).json({ ok: false, error: d?.error || "TON Center error", code: d?.code });

    const raw = pickTotalSupply(d?.result?.stack);
    if (!raw) return res.status(502).json({ ok: false, error: "Cannot parse total_supply from stack" });

    // маленький анти-спам кэш на 5 секунд (чтобы не долбить toncenter)
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=30");

    return res.json({
      ok: true,
      jetton_master: JETTON_MASTER,
      total_supply_raw: raw,
      total_supply: formatJetton(raw, DECIMALS),
      decimals: DECIMALS,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
