const ALLOWED_SOURCES = new Set([
  "info",
  "plots_summary",
  "dkg_status",
  "mints",
  "burns",
  "reinits",
  "internal_keys",
  "system_info",
  "alerts",
]);

const ARRAY_SOURCES = new Set(["mints", "burns", "reinits", "internal_keys", "alerts"]);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

function parseLimit(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  const source = String(req.query.source || "info");
  const limit = parseLimit(req.query.limit);

  if (!ALLOWED_SOURCES.has(source)) {
    return res.status(400).json({
      success: false,
      error: "Invalid source",
      allowed: Array.from(ALLOWED_SOURCES),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const targetUrl = new URL("https://sandbox.teleport.tg/metrics/api");
    targetUrl.searchParams.set("source", source);

    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "tgbtc-miniapp-vercel-proxy/0.2",
      },
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.status(upstream.status).send(text || JSON.stringify({
        success: false,
        error: "Upstream error",
      }));
    }

    let payload = JSON.parse(text);

    if (ARRAY_SOURCES.has(source) && Array.isArray(payload)) {
      payload = payload.slice(0, limit);
    }

    const cacheSeconds = ARRAY_SOURCES.has(source) ? 20 : 10;
    res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate=40`);
    return res.status(200).send(JSON.stringify(payload));
  } catch (error) {
    const isTimeout = error && error.name === "AbortError";
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      error: isTimeout ? "Proxy timeout" : "Proxy error",
      message: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
};
