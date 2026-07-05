const METRICS_API = "https://sandbox.teleport.tg/metrics/api";
const SIGNET_TX_API = "https://mempool.space/signet/api/tx";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "tgbtc-miniapp-pegin-status/0.1",
    },
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function getStatus(op) {
  return op && (op.status || op.Status || (op.mint && op.mint.status) || "");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const txid = String(req.query.txid || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid)) return res.status(400).json({ success: false, error: "Invalid Bitcoin txid" });

    const [info, mints, btcStatus] = await Promise.all([
      fetchJson(`${METRICS_API}?source=info`),
      fetchJson(`${METRICS_API}?source=mints`).catch(() => []),
      fetchJson(`${SIGNET_TX_API}/${txid}/status`).catch((error) => ({ error: error.message, details: error.payload })),
    ]);

    const network = info.BitcoinNetworkInfo || {};
    const client = info.ContractBitcoinClient || {};
    const teleport = info.ContractTeleport || {};
    const lag = Number(network.Blocks || 0) - Number(client.LastConfirmedBlockHeight || 0);
    const mint = Array.isArray(mints)
      ? mints.find((item) => String(item.bitcoin_tx_id || item.BitcoinTxID || item.txid || "").toLowerCase() === txid)
      : null;
    const mintStatus = getStatus(mint);
    const confirmed = Boolean(btcStatus && btcStatus.confirmed);

    let stage = "WAITING_FOR_BTC";
    let reason = "Bitcoin transaction is not confirmed on signet yet.";
    if (confirmed) {
      stage = "BTC_CONFIRMED";
      reason = "Bitcoin transaction is confirmed on signet.";
    }
    if (mint) {
      stage = String(mintStatus || "REGISTERED").toUpperCase();
      reason = "Pegin is registered in the sandbox indexer.";
    }
    if (mint && String(mintStatus).toUpperCase().includes("PENDING") && lag > 100) {
      reason = `Pegin is registered, but the sandbox Bitcoin Client is behind by ${lag} blocks. Mint can stay PENDING until relayers catch up.`;
    }

    return res.status(200).json({
      success: true,
      txid,
      stage,
      reason,
      bitcoin: btcStatus,
      mint: mint || null,
      bridge: {
        enabled: Boolean(teleport.Enabled),
        chain: network.Chain || "",
        networkHeight: Number(network.Blocks || 0),
        clientHeight: Number(client.LastConfirmedBlockHeight || 0),
        lag,
        confirmationsNeeded: Number(client.ConfirmationsNeeded || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Pegin status error",
      message: error.message,
    });
  }
};
