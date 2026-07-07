const MAINNET = {
  minter: "EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU",
  minterRaw: "0:668f1a58b09f321c4ada61f4e92dd7a309e907328292d9f384acfe252c709fe1",
  teleport: "EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-",
  teleportRaw: "0:baa3e462e10dd1dc5d7139368f6b067deb88aa85add3cc91809a98bc8785ea70",
};

const TONAPI = "https://tonapi.io/v2";
const SOURCES = new Set([
  "summary",
  "jetton",
  "holders",
  "master_account",
  "teleport_account",
  "master_transactions",
  "teleport_transactions",
  "master_events",
  "teleport_events",
]);

function limitValue(value, fallback = 30, max = 100) {
  const n = Number.parseInt(String(value || fallback), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function headers() {
  const h = {
    accept: "application/json",
    "user-agent": "tgbtc-mainnet-watch/1.0",
  };
  if (process.env.TONAPI_KEY) h.authorization = `Bearer ${process.env.TONAPI_KEY}`;
  return h;
}

async function getJson(path, params = {}) {
  const url = new URL(`${TONAPI}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.toString(), { headers: headers(), signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!response.ok) {
      return { ok: false, status: response.status, url: url.toString(), body };
    }
    return { ok: true, status: response.status, url: url.toString(), body };
  } finally {
    clearTimeout(timeout);
  }
}

async function sourceData(source, limit) {
  switch (source) {
    case "jetton":
      return getJson(`/jettons/${encodeURIComponent(MAINNET.minter)}`);
    case "holders":
      return getJson(`/jettons/${encodeURIComponent(MAINNET.minter)}/holders`, { limit, offset: 0 });
    case "master_account":
      return getJson(`/blockchain/accounts/${encodeURIComponent(MAINNET.minter)}`);
    case "teleport_account":
      return getJson(`/blockchain/accounts/${encodeURIComponent(MAINNET.teleport)}`);
    case "master_transactions":
      return getJson(`/blockchain/accounts/${encodeURIComponent(MAINNET.minter)}/transactions`, { limit });
    case "teleport_transactions":
      return getJson(`/blockchain/accounts/${encodeURIComponent(MAINNET.teleport)}/transactions`, { limit });
    case "master_events":
      return getJson(`/accounts/${encodeURIComponent(MAINNET.minter)}/events`, { limit });
    case "teleport_events":
      return getJson(`/accounts/${encodeURIComponent(MAINNET.teleport)}/events`, { limit });
    default:
      return { ok: false, status: 400, body: { error: "Unknown source" } };
  }
}

function maybeBody(result) {
  return result && result.ok ? result.body : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  const source = String(req.query.source || "summary");
  const limit = limitValue(req.query.limit);
  if (!SOURCES.has(source)) return res.status(400).json({ success: false, error: "Invalid source", allowed: Array.from(SOURCES) });

  try {
    if (source !== "summary") {
      const result = await sourceData(source, limit);
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
      return res.status(result.ok ? 200 : 502).json({ success: result.ok, source, contracts: MAINNET, status: result.status, data: result.body, upstream: result.url });
    }

    const [jetton, holders, masterAccount, teleportAccount, masterTx, teleportTx, masterEvents, teleportEvents] = await Promise.allSettled([
      sourceData("jetton", limit),
      sourceData("holders", limit),
      sourceData("master_account", limit),
      sourceData("teleport_account", limit),
      sourceData("master_transactions", limit),
      sourceData("teleport_transactions", limit),
      sourceData("master_events", limit),
      sourceData("teleport_events", limit),
    ]);

    function unwrap(item) {
      return item.status === "fulfilled" ? item.value : { ok: false, status: 500, body: { error: item.reason?.message || String(item.reason) } };
    }

    const payload = {
      success: true,
      mode: "mainnet-watch-readonly",
      warning: "READ_ONLY: official tgBTC docs may still describe Teleport as testnet-only. Do not enable real BTC transfers until official mainnet bridge status is confirmed.",
      contracts: MAINNET,
      fetchedAt: new Date().toISOString(),
      results: {
        jetton: unwrap(jetton),
        holders: unwrap(holders),
        masterAccount: unwrap(masterAccount),
        teleportAccount: unwrap(teleportAccount),
        masterTransactions: unwrap(masterTx),
        teleportTransactions: unwrap(teleportTx),
        masterEvents: unwrap(masterEvents),
        teleportEvents: unwrap(teleportEvents),
      },
      data: {
        jetton: maybeBody(unwrap(jetton)),
        holders: maybeBody(unwrap(holders)),
        masterAccount: maybeBody(unwrap(masterAccount)),
        teleportAccount: maybeBody(unwrap(teleportAccount)),
        masterTransactions: maybeBody(unwrap(masterTx)),
        teleportTransactions: maybeBody(unwrap(teleportTx)),
        masterEvents: maybeBody(unwrap(masterEvents)),
        teleportEvents: maybeBody(unwrap(teleportEvents)),
      }
    };

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");
    return res.status(200).json(payload);
  } catch (error) {
    const isTimeout = error && error.name === "AbortError";
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(isTimeout ? 504 : 500).json({ success: false, error: isTimeout ? "Proxy timeout" : "Proxy error", message: error.message, contracts: MAINNET });
  }
};
