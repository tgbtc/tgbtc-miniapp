export default async function handler(req, res) {
  try {
    const r = await fetch("https://sandbox.teleport.tg/app/start", {
      headers: { "user-agent": "Mozilla/5.0", "accept": "text/html" }
    });
    const html = await r.text();

    // ищем window.__CFG__ = {...}
    const m = html.match(/window\.__CFG__\s*=\s*(\{.*?\})\s*;/s);
    if (!m) {
      return res.status(200).json({ ok: false, error: "__CFG__ not found in /app/start html" });
    }

    const cfg = JSON.parse(m[1]);
    res.setHeader("Cache-Control","no-store");
    return res.json({ ok: true, cfg });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
