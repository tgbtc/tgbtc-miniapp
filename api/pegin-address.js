const crypto = require("crypto");

function toHex(buffer) {
  return Buffer.from(buffer).toString("hex");
}

function xOnly(publicKey) {
  return Buffer.from(publicKey).slice(1, 33);
}

function fromBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function crc16Ccitt(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
}

function parseTonAddress(input) {
  const value = String(input || "").trim();
  const rawMatch = value.match(/^(-?\d+):([0-9a-fA-F]{64})$/);
  if (rawMatch) {
    return {
      raw: `${Number(rawMatch[1])}:${rawMatch[2].toLowerCase()}`,
      workChain: Number(rawMatch[1]),
      hash: Buffer.from(rawMatch[2], "hex"),
    };
  }

  const decoded = fromBase64Url(value);
  if (decoded.length !== 36) {
    throw new Error("Invalid TON address: expected raw 0:hash or friendly base64url address");
  }

  const body = decoded.subarray(0, 34);
  const checksum = decoded.readUInt16BE(34);
  const actualChecksum = crc16Ccitt(body);
  if (checksum !== actualChecksum) {
    throw new Error("Invalid TON address checksum");
  }

  const workChainByte = decoded[1];
  const workChain = workChainByte === 0xff ? -1 : workChainByte;
  const hash = decoded.subarray(2, 34);
  return {
    raw: `${workChain}:${hash.toString("hex")}`,
    workChain,
    hash,
  };
}

function tonAddrToTapLeafBytes(parsed) {
  const suffix = parsed.workChain === 0 ? 0x00 : 0xff;
  return Buffer.concat([parsed.hash, Buffer.from([suffix])]);
}

function buildCsvScript(recoveryXOnly, csvLock) {
  const bitcoin = require("bitcoinjs-lib");
  return bitcoin.script.compile([
    bitcoin.script.number.encode((1 << 22) | Number(csvLock)),
    bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
    bitcoin.opcodes.OP_DROP,
    recoveryXOnly,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);
}

function buildOpReturnScript(parsedTonAddress) {
  const bitcoin = require("bitcoinjs-lib");
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
    let bitcoin;
    let ECPair;
    let ecc;
    try {
      bitcoin = require("bitcoinjs-lib");
      ecc = require("tiny-secp256k1");
      ECPair = require("ecpair").ECPairFactory(ecc);
      bitcoin.initEccLib(ecc);
    } catch (dependencyError) {
      return res.status(500).json({
        success: false,
        error: "Missing pegin dependencies",
        message: dependencyError.message,
        hint: "Deploy package.json with bitcoinjs-lib, tiny-secp256k1 and ecpair dependencies, then redeploy on Vercel.",
      });
    }

    const SIGNET = bitcoin.networks.testnet;
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
