export default async function handler(req, res) {
  try {
    const JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
    const API_KEY = process.env.TONCENTER_TESTNET_KEY;

    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "TONCENTER_TESTNET_KEY is missing in Vercel env" });
    }

    const url = `https://testnet.toncenter.com/api/v2/getTokenData?address=${encodeURIComponent(JETTON_MASTER)}`;

    const r = await fetch(url, {
      headers: {
        "accept": "application/json",
        "X-API-Key": API_KEY,
      },
      cache: "no-store",
    });

    const text = await r.text();

    // На всякий случай: если toncenter вернул не JSON — покажем это
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: "toncenter returned non-json", raw: text.slice(0, 500) });
    }

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `toncenter_http_${r.status}`, raw: json });
    }

    // Отдаём как есть (там уже { ok: true, result: ... })
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
