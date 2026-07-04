const ALLOWED_SOURCES = new Set([
  "info",
  "plots_summary",
  "dkg_status",
  "mints",
  "burns",
]);

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const source = String(req.query.source || "info");

    if (!ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({
        error: "Invalid source",
        allowed: Array.from(ALLOWED_SOURCES),
      });
    }

    const targetUrl = new URL("https://sandbox.teleport.tg/metrics/api");
    targetUrl.searchParams.set("source", source);

    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        "accept": "application/json",
        "user-agent": "tgbtc-miniapp-vercel-proxy",
      },
    });

    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    return res.send(text);
  } catch (error) {
    return res.status(500).json({
      error: "Proxy error",
      message: error.message,
    });
  }
};
