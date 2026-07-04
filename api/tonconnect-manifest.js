module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const origin = `${proto}://${host}`;

  return res.status(200).json({
    url: origin,
    name: "tgBTC Sandbox Explorer",
    iconUrl: "https://ton.org/download/ton_symbol.png",
  });
};
