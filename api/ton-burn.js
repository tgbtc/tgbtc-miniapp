const { Address, beginCell, toNano } = require("@ton/core");

const JETTON_BURN = 0x595f07bc;
const BURN_VALUE_NANO = toNano("1");

function parseAmountSats(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) throw new Error("amountSats must be an integer string");
  const sats = BigInt(text);
  if (sats <= 0n) throw new Error("amountSats must be positive");
  return sats;
}

function parseUserFee(value) {
  const text = String(value || "0").trim();
  if (!/^\d+$/.test(text)) throw new Error("userFee must be an integer string");
  const fee = BigInt(text);
  if (fee > 0xffffffffffffffffn) throw new Error("userFee is too large");
  return fee;
}

function parseScript(value) {
  const script = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(script) || script.length % 2 !== 0) throw new Error("Invalid Bitcoin script hex");
  const buffer = Buffer.from(script, "hex");
  if (!buffer.length || buffer.length > 255) throw new Error("Bitcoin script length must be 1..255 bytes");
  return buffer;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const ownerAddress = Address.parse(String(body.ownerAddress || "").trim());
    const jettonWalletAddress = Address.parse(String(body.jettonWalletAddress || "").trim());
    const amountSats = parseAmountSats(body.amountSats);
    const userFee = parseUserFee(body.userFee);
    const outputScript = parseScript(body.scriptPubKey);

    const payloadCell = beginCell()
      .storeUint(outputScript.length, 8)
      .storeBuffer(outputScript)
      .storeUint(userFee, 64)
      .endCell();

    const bodyCell = beginCell()
      .storeUint(JETTON_BURN, 32)
      .storeUint(BigInt(Date.now()), 64)
      .storeCoins(amountSats)
      .storeAddress(ownerAddress)
      .storeMaybeRef(payloadCell)
      .endCell();

    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      network: "-3",
      messages: [
        {
          address: jettonWalletAddress.toString({ urlSafe: true, bounceable: true, testOnly: true }),
          amount: BURN_VALUE_NANO.toString(),
          payload: bodyCell.toBoc().toString("base64"),
        },
      ],
    };

    return res.status(200).json({
      success: true,
      op: `0x${JETTON_BURN.toString(16)}`,
      valueNano: BURN_VALUE_NANO.toString(),
      valueTon: "1",
      amountSats: amountSats.toString(),
      userFee: userFee.toString(),
      scriptPubKey: outputScript.toString("hex"),
      payloadBocBase64: tx.messages[0].payload,
      transaction: tx,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Build burn transaction error",
      message: error.message,
    });
  }
};
