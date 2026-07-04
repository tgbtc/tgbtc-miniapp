const crypto = require("crypto");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const { Address } = require("@ton/core");

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const SIGNET = bitcoin.networks.testnet;

function toHex(buffer) {
  return Buffer.from(buffer).toString("hex");
}

function xOnly(publicKey) {
  return Buffer.from(publicKey).slice(1, 33);
}

function parseTonAddress(input) {
  const addr = Address.parse(String(input || "").trim());
  return {
    raw: `${addr.workChain}:${addr.hash.toString("hex")}`,
    workChain: addr.workChain,
    hash: Buffer.from(addr.hash),
  };
}

function tonAddrToTapLeafBytes(parsed) {
  const suffix = parsed.workChain === 0 ? 0x00 : 0xff;
  return Buffer.concat([parsed.hash, Buffer.from([suffix])]);
}

function buildCsvScript(recoveryXOnly, csvLock) {
  return bitcoin.script.compile([
    bitcoin.script.number.encode((1 << 22) | Number(csvLock)),
    bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
    bitcoin.opcodes.OP_DROP,
    recoveryXOnly,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
}

function buildOpReturnScript(parsedTonAddress) {
  return bitcoin.script.compile([
    bitcoin.opcodes.OP_RETURN,
    tonAddrToTapLeafBytes(parsedTonAddress),
  ]);
}

async function fetchInfo() {
  const response = await fetch("https://sandbox.teleport.tg/metrics/api?source=info", {
    headers: {
      accept: "application/json",
      "user-agent": "tgbtc-miniapp-pegin-address/0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`metrics info HTTP ${response.status}`);
  }
  return response.json();
}

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
    const receiver = parseTonAddress(body.receiverAddr);
    const info = await fetchInfo();
    const teleport = info.ContractTeleport || {};
    const internalKeyHex = String(teleport.InternalKey || "");
    const csvLock = Number(teleport.CsvLock || 338);
    const minPeginSats = Number((teleport.Limits && teleport.Limits.MinPeginAmount) || 0);

    if (!teleport.Enabled) {
      return res.status(409).json({ success: false, error: "Teleport sandbox is disabled" });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(internalKeyHex)) {
      return res.status(500).json({ success: false, error: "Invalid internal key from metrics" });
    }

    const recoveryPair = ECPair.makeRandom({
      network: SIGNET,
      rng: (size) => crypto.randomBytes(size),
    });
    const recoveryPrivateKeyHex = toHex(recoveryPair.privateKey);
    const recoveryPublicKeyHex = toHex(xOnly(recoveryPair.publicKey));
    const internalPubkey = Buffer.from(internalKeyHex, "hex");
    const csvScript = buildCsvScript(Buffer.from(recoveryPublicKeyHex, "hex"), csvLock);
    const opReturnScript = buildOpReturnScript(receiver);

    const payment = bitcoin.payments.p2tr({
      internalPubkey,
      scriptTree: [
        { output: csvScript },
        { output: opReturnScript },
      ],
      network: SIGNET,
    });

    if (!payment.address || !payment.output) {
      throw new Error("failed to build Taproot payment");
    }

    return res.status(200).json({
      success: true,
      network: "signet",
      btcAddress: payment.address,
      scriptPubKey: payment.output.toString("hex"),
      receiverAddr: receiver.raw,
      internalKey: internalKeyHex,
      recoveryKey: recoveryPublicKeyHex,
      recoveryPrivateKey: recoveryPrivateKeyHex,
      csvLock,
      minPeginSats,
      minPeginBtc: (minPeginSats / 1e8).toFixed(8),
      warning: "Sandbox only. Save recoveryPrivateKey if you send signet BTC.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Pegin address error",
      message: error.message,
    });
  }
};
