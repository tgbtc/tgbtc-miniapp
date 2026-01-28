export default async function handler(req, res) {
  try {
    const TELEPORT_URL = process.env.TELEPORT_TESTNET_URL;
    if (!TELEPORT_URL) {
      return res.status(500).json({ ok: false, error: "Missing env TELEPORT_TESTNET_URL" });
    }

    const r = await fetch(TELEPORT_URL, {
      headers: { "user-agent": "tgBTCfi/1.0" }
    });

    const html = await r.text();

    // 1) BTC address (tb1p... taproot / tb1q... segwit — на всякий)
    const addrMatch = html.match(/\b(tb1[qp][a-z0-9]{20,})\b/i);
    const btc_address = addrMatch ? addrMatch[1] : null;

    // 2) Remaining time like: "47m : 35s"
    const timeMatch = html.match(/(\d{1,3})\s*m\s*:\s*(\d{1,2})\s*s/i);
    const mm = timeMatch ? parseInt(timeMatch[1], 10) : null;
    const ss = timeMatch ? parseInt(timeMatch[2], 10) : null;

    const remaining_seconds =
      (Number.isFinite(mm) && Number.isFinite(ss)) ? (mm * 60 + ss) : null;

    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, btc_address, remaining_seconds });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
