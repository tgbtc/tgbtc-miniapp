module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const address = String(req.query.address || "").trim();
    if (!/^tb1[023456789acdefghjklmnpqrstuvwxyz]{20,90}$/i.test(address)) {
      return res.status(400).json({ success: false, error: "Invalid signet/testnet Bitcoin address" });
    }

    const base = `https://mempool.space/signet/api/address/${encodeURIComponent(address)}`;
    const [infoRes, txsRes] = await Promise.all([
      fetch(base, { headers: { accept: "application/json", "user-agent": "tgbtc-miniapp-signet-watch/0.1" } }),
      fetch(`${base}/txs`, { headers: { accept: "application/json", "user-agent": "tgbtc-miniapp-signet-watch/0.1" } }),
    ]);

    const infoText = await infoRes.text();
    const txsText = await txsRes.text();

    if (!infoRes.ok) return res.status(infoRes.status).send(infoText);
    if (!txsRes.ok) return res.status(txsRes.status).send(txsText);

    const info = JSON.parse(infoText);
    const txs = JSON.parse(txsText);
    const simplifiedTxs = Array.isArray(txs) ? txs.slice(0, 10).map((tx) => ({
      txid: tx.txid,
      confirmed: Boolean(tx.status && tx.status.confirmed),
      blockHeight: tx.status && tx.status.block_height,
      blockTime: tx.status && tx.status.block_time,
    })) : [];

    return res.status(200).json({
      success: true,
      address,
      chainFundedSats: Number(info.chain_stats && info.chain_stats.funded_txo_sum || 0),
      mempoolFundedSats: Number(info.mempool_stats && info.mempool_stats.funded_txo_sum || 0),
      chainTxCount: Number(info.chain_stats && info.chain_stats.tx_count || 0),
      mempoolTxCount: Number(info.mempool_stats && info.mempool_stats.tx_count || 0),
      txs: simplifiedTxs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Signet watcher error",
      message: error.message,
    });
  }
};
