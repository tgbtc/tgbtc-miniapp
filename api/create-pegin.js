const GRAPHQL_ENDPOINT = "https://sandbox.teleport.tg/indexer/graphql";

const CREATE_PEGIN = `
mutation CreatePegin($input: CreatePeginInput!) {
  createPegin(input: $input) {
    id
    receiverAddr
    bitcoinTxID
    voutIndex
    internalKey
    recoveryKey
    mint {
      id
      amount
      status
      createdAt
    }
  }
}`;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const receiverAddr = String(body.receiverAddr || "").trim();
    const bitcoinTxID = String(body.bitcoinTxID || "").trim();
    const internalKey = String(body.internalKey || "").trim();
    const recoveryKey = String(body.recoveryKey || "").trim();

    if (!/^[-]?\d+:[0-9a-fA-F]{64}$/.test(receiverAddr)) {
      return res.status(400).json({ success: false, error: "Invalid raw TON receiver address" });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(bitcoinTxID)) {
      return res.status(400).json({ success: false, error: "Invalid Bitcoin txid" });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(internalKey)) {
      return res.status(400).json({ success: false, error: "Invalid internal key" });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(recoveryKey)) {
      return res.status(400).json({ success: false, error: "Invalid recovery key" });
    }

    const upstream = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "tgbtc-miniapp-create-pegin/0.1",
      },
      body: JSON.stringify({
        query: CREATE_PEGIN,
        variables: {
          input: {
            receiverAddr,
            bitcoinTxID,
            internalKey,
            recoveryKey,
          },
        },
      }),
    });

    const payload = await upstream.json();
    if (!upstream.ok || payload.errors) {
      return res.status(upstream.ok ? 422 : upstream.status).json({
        success: false,
        error: "Indexer rejected pegin",
        details: payload.errors || payload,
      });
    }

    return res.status(200).json({
      success: true,
      data: payload.data.createPegin,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Create pegin error",
      message: error.message,
    });
  }
};
