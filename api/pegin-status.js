module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const txid = String(req.query.txid || "").trim();
    const requestedCsvLock = Number.parseInt(String(req.query.csvLock || "0"), 10);
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
      return res.status(400).json({ success: false, error: "Invalid Bitcoin txid" });
    }

    const [txRes, infoRes] = await Promise.all([
      fetch(`https://mempool.space/signet/api/tx/${txid}`, { headers: { accept: "application/json", "user-agent": "tgbtc-miniapp-pegin-status/0.1" } }),
      fetch("https://sandbox.teleport.tg/metrics/api?source=info", { headers: { accept: "application/json", "user-agent": "tgbtc-miniapp-pegin-status/0.1" } }),
    ]);

    const txText = await txRes.text();
    const infoText = await infoRes.text();
    if (!txRes.ok) return res.status(txRes.status).send(txText);
    if (!infoRes.ok) return res.status(infoRes.status).send(infoText);

    const tx = JSON.parse(txText);
    const info = JSON.parse(infoText);
    const teleport = info.ContractTeleport || {};
    const client = info.ContractBitcoinClient || {};
    const network = info.BitcoinNetworkInfo || {};

    const confirmed = Boolean(tx.status && tx.status.confirmed);
    const txBlockHeight = confirmed ? Number(tx.status.block_height || 0) : 0;
    const networkHeight = Number(network.Blocks || 0);
    const clientHeight = Number(client.LastConfirmedBlockHeight || 0);
    const requiredConfirmations = Number(client.ConfirmationsNeeded || 0);
    const csvLock = Number.isFinite(requestedCsvLock) && requestedCsvLock > 0 ? requestedCsvLock : Number(teleport.CsvLock || 0);
    const publicConfirmations = confirmed && txBlockHeight > 0 && networkHeight >= txBlockHeight ? (networkHeight - txBlockHeight + 1) : 0;
    const teleportReadyHeight = txBlockHeight > 0 ? (txBlockHeight + Math.max(requiredConfirmations - 1, 0)) : 0;
    const remainingClientBlocks = teleportReadyHeight > clientHeight ? (teleportReadyHeight - clientHeight) : 0;
    const teleportReady = confirmed && clientHeight >= teleportReadyHeight;
    const refundMatureHeight = txBlockHeight > 0 && csvLock > 0 ? (txBlockHeight + csvLock) : 0;
    const remainingRefundBlocks = refundMatureHeight > networkHeight ? (refundMatureHeight - networkHeight) : 0;
    const refundReady = confirmed && refundMatureHeight > 0 && networkHeight >= refundMatureHeight;

    return res.status(200).json({
      success: true,
      txid,
      confirmed,
      txBlockHeight,
      networkHeight,
      clientHeight,
      publicConfirmations,
      requiredConfirmations,
      teleportReadyHeight,
      remainingClientBlocks,
      teleportReady,
      csvLock,
      refundMatureHeight,
      remainingRefundBlocks,
      refundReady,
      reason: !confirmed
        ? "Bitcoin tx is not confirmed on public signet yet"
        : !teleportReady
          ? "Teleport sandbox Bitcoin Client has not reached this tx block/confirmation height yet"
          : "Teleport Bitcoin Client height is enough; relayer/proof/mint pipeline should be checked",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Pegin status error",
      message: error.message,
    });
  }
};
