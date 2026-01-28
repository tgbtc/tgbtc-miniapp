export default async function handler(req, res) {
  try {
    const TELEPORT_URL = process.env.TELEPORT_TESTNET_URL;
    if (!TELEPORT_URL) {
      return res.status(500).json({ ok: false, error: "Missing TELEPORT_TESTNET_URL env" });
    }

    const r = await fetch(TELEPORT_URL, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await r.text();

    // попробуем найти любые URL внутри HTML (часто там есть /api/... или json endpoint)
    const urls = Array.from(html.matchAll(/https?:\/\/[^\s"'<>]+/g)).slice(0, 50).map(m => m[0]);

    // также попробуем найти относительные api пути
    const apiPaths = Array.from(html.matchAll(/["'`](\/[^"'`]*api[^"'`]*)["'`]/gi))
      .slice(0, 50)
      .map(m => m[1]);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      note: "diag",
      status: r.status,
      sample: html.slice(0, 4000),
      found_urls: urls,
      found_api_paths: apiPaths
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
