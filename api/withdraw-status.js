const TONAPI = "https://testnet.tonapi.io/v2";
const TGBTC_MASTER = "0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "tgbtc-miniapp-withdraw-status/0.1",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function fmt(raw) {
  const value = BigInt(String(raw || "0"));
  const whole = value / 100000000n;
  const frac = String(value % 100000000n).padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function op(tx) {
  return tx && tx.in_msg && String(tx.in_msg.op_code || "").toLowerCase();
}

function amount(tx) {
  return tx && tx.in_msg && tx.in_msg.decoded_body && String(tx.in_msg.decoded_body.amount || "");
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
    const owner = String(req.query.owner || "").trim();
    if (!owner) return res.status(400).json({ success: false, error: "Missing owner address" });

    const jetton = await fetchJson(`${TONAPI}/accounts/${encodeURIComponent(owner)}/jettons/${encodeURIComponent(TGBTC_MASTER)}`);
    const walletAddress = jetton.wallet_address && jetton.wallet_address.address;
    if (!walletAddress) {
      return res.status(200).json({ success: true, owner, walletAddress: "", status: "NO_TGBTC_WALLET" });
    }

    const txs = await fetchJson(`${TONAPI}/blockchain/accounts/${encodeURIComponent(walletAddress)}/transactions?limit=12`);
    const transactions = Array.isArray(txs.transactions) ? txs.transactions : [];
    const latestBurn = transactions.find((tx) => op(tx) === "0x595f07bc");
    const latestRefund = latestBurn
      ? transactions.find((tx) => {
        const isInternalTransfer = op(tx) === "0x178d4519";
        const fromMaster = tx.in_msg && tx.in_msg.source && tx.in_msg.source.address === TGBTC_MASTER;
        return isInternalTransfer && fromMaster && amount(tx) === amount(latestBurn) && Number(tx.utime || 0) >= Number(latestBurn.utime || 0);
      })
      : null;

    let status = "NO_RECENT_BURN";
    let message = "No recent tgBTC burn found for this wallet.";
    if (latestBurn && latestRefund) {
      status = "REFUNDED";
      message = "Burn was accepted by the jetton wallet, then tgBTC was minted back to the owner. No BTC pegout was produced.";
    } else if (latestBurn && latestBurn.success) {
      status = "BURN_SENT";
      message = "Burn was accepted. Waiting for Teleport pegout/refund indexing.";
    } else if (latestBurn && latestBurn.success === false) {
      status = "BURN_FAILED";
      message = `Burn failed in jetton wallet, exit code ${latestBurn.compute_phase && latestBurn.compute_phase.exit_code}.`;
    }

    return res.status(200).json({
      success: true,
      owner,
      walletAddress,
      balance: String(jetton.balance || "0"),
      balanceTgBtc: fmt(jetton.balance),
      status,
      message,
      burn: latestBurn ? {
        hash: latestBurn.hash,
        utime: latestBurn.utime,
        success: latestBurn.success,
        amount: amount(latestBurn),
        amountTgBtc: fmt(amount(latestBurn)),
        exitCode: latestBurn.compute_phase && latestBurn.compute_phase.exit_code,
      } : null,
      refund: latestRefund ? {
        hash: latestRefund.hash,
        utime: latestRefund.utime,
        success: latestRefund.success,
        amount: amount(latestRefund),
        amountTgBtc: fmt(amount(latestRefund)),
      } : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Withdraw status error",
      message: error.message,
      details: error.payload,
    });
  }
};
