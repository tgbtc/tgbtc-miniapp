export default async function handler(req, res) {
  try {
    const TELEPORT_URL = process.env.TELEPORT_TESTNET_URL;
    if (!TELEPORT_URL) {
      return res.status(500).json({ ok: false, error: "Missing TELEPORT_TESTNET_URL env" });
    }

    const page = new URL(TELEPORT_URL);

    const r1 = await fetch(page.toString(), {
      headers: { "user-agent": "Mozilla/5.0", "accept": "text/html" }
    });
    const html = await r1.text();

    // найти главный модуль /assets/index-XXXX.js
    const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i);
    const mainJsPath = m ? m[1] : null;

    if (!mainJsPath) {
      return res.status(200).json({ ok: false, error: "Main module script not found in HTML" });
    }

    const mainJsUrl = new URL(mainJsPath, page.origin).toString();

    const r2 = await fetch(mainJsUrl, {
      headers: { "user-agent": "Mozilla/5.0", "accept": "*/*" }
    });
    const js = await r2.text();

    // 1) абсолютные URL
    const abs = Array.from(js.matchAll(/https?:\/\/[^\s"'<>\\]+/g)).map(x => x[0]);

    // 2) относительные пути, похожие на API/JSON/bridge
    const rel = Array.from(js.matchAll(/["'`](\/[^"'`\\]*(api|v1|v2|v3|bridge|deposit|mint|btc|address|session|order)[^"'`\\]*)["'`]/gi))
      .map(x => x[1]);

    // 3) домены / базовые урлы (иногда лежат как teleportApiBase="...")
    const bases = Array.from(js.matchAll(/(baseURL|apiBase|endpoint|host|origin)["']?\s*[:=]\s*["']([^"']+)["']/gi))
      .map(x => ({ key: x[1], value: x[2] }));

    // уникализируем + ограничим
    const uniq = (arr) => [...new Set(arr)].slice(0, 80);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      status_html: r1.status,
      status_js: r2.status,
      main_js: mainJsUrl,
      found_abs_urls: uniq(abs),
      found_rel_paths: uniq(rel),
      found_base_candidates: bases.slice(0, 40)
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
