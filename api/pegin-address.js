const crypto = require("crypto");

const BECH32M_CONST = 0x2bc830a3;
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const CURVE_N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function hexToBytes(hex) {
  return Buffer.from(hex, "hex");
}

function sha256(...parts) {
  const hash = crypto.createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function taggedHash(tag, data) {
  const tagHash = sha256(Buffer.from(tag, "utf8"));
  return sha256(tagHash, tagHash, data);
}

function compactSize(n) {
  if (n < 253) return Buffer.from([n]);
  throw new Error("compactSize > 252 is not needed for pegin scripts");
}

function scriptNumber(n) {
  if (n === 0) return Buffer.alloc(0);
  const result = [];
  let value = Number(n);
  while (value > 0) {
    result.push(value & 0xff);
    value >>= 8;
  }
  if (result[result.length - 1] & 0x80) {
    result.push(0);
  }
  return Buffer.from(result);
}

function pushData(data) {
  if (data.length > 75) throw new Error("pushData too long");
  return Buffer.concat([Buffer.from([data.length]), Buffer.from(data)]);
}

function buildCsvScript(recoveryXOnly, csvLock) {
  const sequence = scriptNumber((1 << 22) | Number(csvLock));
  return Buffer.concat([
    pushData(sequence),
    Buffer.from([0xb2, 0x75]),
    pushData(recoveryXOnly),
    Buffer.from([0xac]),
  ]);
}

function buildOpReturnScript(parsedTonAddress) {
  return Buffer.concat([
    Buffer.from([0x6a]),
    pushData(tonAddrToTapLeafBytes(parsedTonAddress)),
  ]);
}

function tapLeafHash(script) {
  return taggedHash("TapLeaf", Buffer.concat([Buffer.from([0xc0]), compactSize(script.length), script]));
}

function tapBranchHash(a, b) {
  const leftFirst = Buffer.compare(a, b) <= 0;
  return taggedHash("TapBranch", Buffer.concat(leftFirst ? [a, b] : [b, a]));
}

function bech32Polymod(values) {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= generator[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const result = [];
  for (let i = 0; i < hrp.length; i += 1) result.push(hrp.charCodeAt(i) >> 5);
  result.push(0);
  for (let i = 0; i < hrp.length; i += 1) result.push(hrp.charCodeAt(i) & 31);
  return result;
}

function bech32CreateChecksum(hrp, data) {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ BECH32M_CONST;
  const result = [];
  for (let p = 0; p < 6; p += 1) result.push((polymod >> (5 * (5 - p))) & 31);
  return result;
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits) throw new Error("invalid convertBits value");
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) result.push((acc << (toBits - bits)) & maxv);
  return result;
}

function encodeP2trAddress(xOnlyOutputKey) {
  const hrp = "tb";
  const data = [1, ...convertBits(xOnlyOutputKey, 8, 5, true)];
  const combined = [...data, ...bech32CreateChecksum(hrp, data)];
  return `${hrp}1${combined.map((v) => CHARSET[v]).join("")}`;
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
  if (checksum !== crc16Ccitt(body)) throw new Error("Invalid TON address checksum");

  const workChain = decoded[1] === 0xff ? -1 : decoded[1];
  const hash = decoded.subarray(2, 34);
  return { raw: `${workChain}:${hash.toString("hex")}`, workChain, hash };
}

function tonAddrToTapLeafBytes(parsed) {
  const suffix = parsed.workChain === 0 ? 0x00 : 0xff;
  return Buffer.concat([parsed.hash, Buffer.from([suffix])]);
}

function randomPrivateKey(secp) {
  while (true) {
    const key = crypto.randomBytes(32);
    const value = BigInt(`0x${key.toString("hex")}`);
    const valid = secp.utils.isValidPrivateKey
      ? secp.utils.isValidPrivateKey(key)
      : secp.utils.isValidSecretKey(key);
    if (value > 0n && value < CURVE_N && valid) return key;
  }
}

async function fetchInfo() {
  const response = await fetch("https://sandbox.teleport.tg/metrics/api?source=info", {
    headers: {
      accept: "application/json",
      "user-agent": "tgbtc-miniapp-pegin-address/0.2",
    },
  });
  if (!response.ok) throw new Error(`metrics info HTTP ${response.status}`);
  return response.json();
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
    let secp;
    try {
      secp = await import("@noble/secp256k1");
    } catch (dependencyError) {
      return res.status(500).json({
        success: false,
        error: "Missing pegin dependency",
        message: dependencyError.message,
        hint: "Deploy the updated package.json with @noble/secp256k1, then redeploy on Vercel.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const receiver = parseTonAddress(body.receiverAddr);
    const info = await fetchInfo();
    const teleport = info.ContractTeleport || {};
    const internalKeyHex = String(teleport.InternalKey || "");
    const csvLock = Number(teleport.CsvLock || 338);
    const minPeginSats = Number((teleport.Limits && teleport.Limits.MinPeginAmount) || 0);

    if (!teleport.Enabled) return res.status(409).json({ success: false, error: "Teleport sandbox is disabled" });
    if (!/^[0-9a-fA-F]{64}$/.test(internalKeyHex)) {
      return res.status(500).json({ success: false, error: "Invalid internal key from metrics" });
    }

    const recoveryPrivateKey = randomPrivateKey(secp);
    const recoveryPublicKey = secp.getPublicKey(recoveryPrivateKey, true);
    const recoveryXOnly = Buffer.from(recoveryPublicKey).subarray(1, 33);
    const internalXOnly = hexToBytes(internalKeyHex);

    const csvScript = buildCsvScript(recoveryXOnly, csvLock);
    const opReturnScript = buildOpReturnScript(receiver);
    const merkleRoot = tapBranchHash(tapLeafHash(csvScript), tapLeafHash(opReturnScript));
    const tweak = taggedHash("TapTweak", Buffer.concat([internalXOnly, merkleRoot]));

    const Point = secp.ProjectivePoint || secp.Point;
    if (!Point) throw new Error("Unsupported @noble/secp256k1 Point API");
    const internalPoint = Point.fromHex(`02${internalKeyHex}`);
    const tweakInt = BigInt(`0x${tweak.toString("hex")}`) % CURVE_N;
    if (tweakInt === 0n) throw new Error("Invalid zero tap tweak");
    const outputPoint = internalPoint.add(Point.BASE.multiply(tweakInt));
    const outputXOnly = hexToBytes(outputPoint.toHex(true).slice(2, 66));
    const scriptPubKey = Buffer.concat([Buffer.from([0x51, 0x20]), outputXOnly]);

    return res.status(200).json({
      success: true,
      network: "signet",
      btcAddress: encodeP2trAddress(outputXOnly),
      scriptPubKey: scriptPubKey.toString("hex"),
      receiverAddr: receiver.raw,
      internalKey: internalKeyHex,
      recoveryKey: bytesToHex(recoveryXOnly),
      recoveryPrivateKey: bytesToHex(recoveryPrivateKey),
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
