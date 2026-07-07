const { Address, beginCell } = require("@ton/core");

const TGBTC_MASTER_RAW = "0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074";
const TON_TESTNET_CHAIN = "-3";
const BURN_OPCODE = 0x595f07bc;

function asJson(res, code, payload) {
  res.status(code).json(payload);
}

function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

function validateAmount(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) throw new Error("Invalid amountSats");
  const amount = BigInt(text);
  if (amount <= 0n) throw new Error("amountSats must be positive");
  return amount;
}

function validateGas(value) {
  const text = String(value || "150000000").trim();
  if (!/^\d+$/.test(text)) throw new Error("Invalid gasNanoton");
  const gas = BigInt(text);
  if (gas < 50000000n) throw new Error("gasNanoton is too low; use at least 50000000");
  return gas.toString();
}

function parseHexPayload(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(text) || text.length % 2 !== 0) throw new Error("Invalid customPayloadHex");
  const bytes = Buffer.from(text, "hex");
  if (bytes.length < 1 || bytes.length > 120) throw new Error("customPayloadHex length is out of range");
  return bytes;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return asJson(res, 405, { success: false, error: "Method not allowed" });

  try {
    const body = parseBody(req);
    const ownerAddress = String(body.ownerAddress || "").trim();
    const jettonWalletAddressRaw = String(body.jettonWalletAddress || "").trim();
    if (!jettonWalletAddressRaw) {
      throw new Error("Paste your tgBTC jetton wallet address into the manual field. Auto-resolve is disabled in this stable deploy build.");
    }

    const owner = Address.parse(ownerAddress);
    const jettonWallet = Address.parse(jettonWalletAddressRaw);
    const master = Address.parse(TGBTC_MASTER_RAW);
    const ownerRaw = owner.toRawString().toLowerCase();
    const jettonRaw = jettonWallet.toRawString().toLowerCase();
    const masterRaw = master.toRawString().toLowerCase();
    if (jettonRaw === ownerRaw) throw new Error("Unsafe burn target: this is the owner wallet, not the tgBTC jetton wallet");
    if (jettonRaw === masterRaw) throw new Error("Unsafe burn target: this is the tgBTC master/minter, not your tgBTC jetton wallet");
    const amount = validateAmount(body.amountSats);
    const customPayload = parseHexPayload(body.customPayloadHex);
    const gasNanoton = validateGas(body.gasNanoton);

    const customPayloadCell = beginCell().storeBuffer(customPayload).endCell();
    const queryId = BigInt(Date.now());

    // Standard Jetton burn:
    // burn#595f07bc query_id:uint64 amount:(VarUInteger 16)
    // response_destination:MsgAddress custom_payload:(Maybe ^Cell)
    const burnBody = beginCell()
      .storeUint(BURN_OPCODE, 32)
      .storeUint(queryId, 64)
      .storeCoins(amount)
      .storeAddress(owner)
      .storeBit(1)
      .storeRef(customPayloadCell)
      .endCell();

    const payloadBoc = burnBody.toBoc({ idx: false }).toString("base64");
    const jettonWalletAddress = jettonWallet.toString({ testOnly: true, bounceable: true });

    return asJson(res, 200, {
      success: true,
      chain: TON_TESTNET_CHAIN,
      masterAddress: master.toString({ testOnly: true, bounceable: true }),
      ownerAddress: owner.toString({ testOnly: true, bounceable: true }),
      jettonWalletAddress,
      amountSats: amount.toString(),
      queryId: queryId.toString(),
      payloadBoc,
      transaction: {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        network: TON_TESTNET_CHAIN,
        messages: [
          {
            address: jettonWalletAddress,
            amount: gasNanoton,
            payload: payloadBoc
          }
        ]
      }
    });
  } catch (error) {
    return asJson(res, 400, {
      success: false,
      error: "Cannot build tgBTC burn transaction",
      message: error.message,
      hint: "Connect TON testnet wallet and paste the tgBTC jetton wallet address manually. This avoids @ton/ton/TonCenter deployment issues."
    });
  }
};
