const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

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

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits) throw new Error("invalid bech32 data");
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error("invalid padding");
  }
  return Buffer.from(result);
}

function decodeBech32(address) {
  const value = String(address || "").trim().toLowerCase();
  const pos = value.lastIndexOf("1");
  if (pos < 1 || pos + 7 > value.length) throw new Error("invalid bech32 address");
  const hrp = value.slice(0, pos);
  const dataChars = value.slice(pos + 1);
  const data = [...dataChars].map((char) => {
    const index = CHARSET.indexOf(char);
    if (index < 0) throw new Error("invalid bech32 character");
    return index;
  });
  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...data]);
  const encoding = polymod === BECH32_CONST ? "bech32" : polymod === BECH32M_CONST ? "bech32m" : null;
  if (!encoding) throw new Error("invalid bech32 checksum");
  return { hrp, encoding, words: data.slice(0, -6) };
}

function scriptForAddress(address) {
  const decoded = decodeBech32(address);
  if (decoded.hrp !== "tb") throw new Error("Only Bitcoin signet/testnet tb1 addresses are supported");
  const version = decoded.words[0];
  const program = convertBits(decoded.words.slice(1), 5, 8, false);
  if (version === 0 && decoded.encoding !== "bech32") throw new Error("v0 witness address must use bech32");
  if (version > 0 && decoded.encoding !== "bech32m") throw new Error("v1+ witness address must use bech32m");

  if (version === 0 && program.length === 20) return Buffer.concat([Buffer.from([0x00, 0x14]), program]);
  if (version === 0 && program.length === 32) return Buffer.concat([Buffer.from([0x00, 0x20]), program]);
  if (version === 1 && program.length === 32) return Buffer.concat([Buffer.from([0x51, 0x20]), program]);
  throw new Error("Unsupported witness program. Use tb1q P2WPKH/P2WSH or tb1p P2TR address.");
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
    const address = String(req.query.address || "").trim();
    const script = scriptForAddress(address);
    return res.status(200).json({
      success: true,
      network: "signet",
      address,
      scriptPubKey: script.toString("hex"),
      scriptLength: script.length,
      supported: true,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: "Invalid Bitcoin output address",
      message: error.message,
    });
  }
};
