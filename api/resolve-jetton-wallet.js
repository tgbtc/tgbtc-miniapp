const { Address } = require("@ton/core");

const TGBTC_MASTER_RAW = "0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074";
const DECIMALS = 8;

function asJson(res, code, payload) {
  res.status(code).json(payload);
}

function normalizeRaw(value) {
  if (!value) return "";
  try {
    return Address.parse(String(value)).toRawString().toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

function friendly(value, bounceable = true) {
  return Address.parse(String(value)).toString({ testOnly: true, bounceable });
}

function unitsToDecimal(units, decimals = DECIMALS) {
  const value = BigInt(String(units || "0"));
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = String(value % base).padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

function pickAddress(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.address === "string") return value.address;
    if (value.address && typeof value.address.address === "string") return value.address.address;
    if (typeof value.account_address === "string") return value.account_address;
    if (typeof value.wallet_address === "string") return value.wallet_address;
  }
  return "";
}

async function fetchJson(url) {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "accept": "application/json", "user-agent": "tgbtc-miniapp/0.8" }
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!r.ok) throw new Error(`TonAPI HTTP ${r.status}: ${text.slice(0, 160)}`);
  return json;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return asJson(res, 405, { success: false, error: "Method not allowed" });

  try {
    const ownerInput = String(req.query.owner || "").trim();
    if (!ownerInput) throw new Error("Missing owner address");

    const owner = Address.parse(ownerInput);
    const ownerRaw = owner.toRawString();
    const ownerFriendly = owner.toString({ testOnly: true, bounceable: false });
    const masterRaw = normalizeRaw(TGBTC_MASTER_RAW);

    const attempts = [ownerRaw, ownerFriendly];
    let lastJson = null;
    let lastError = null;

    for (const account of attempts) {
      try {
        const url = `https://testnet.tonapi.io/v2/accounts/${encodeURIComponent(account)}/jettons`;
        const json = await fetchJson(url);
        lastJson = json;
        const balances = Array.isArray(json.balances) ? json.balances : (Array.isArray(json.jettons) ? json.jettons : []);
        for (const item of balances) {
          const jetton = item.jetton || item.jetton_info || item.metadata || {};
          const jettonAddress = pickAddress(jetton.address) || pickAddress(jetton);
          const symbol = String(jetton.symbol || item.symbol || "").toLowerCase();
          const addressMatches = jettonAddress && normalizeRaw(jettonAddress) === masterRaw;
          const symbolMatches = symbol === "tgbtc";
          if (!addressMatches && !symbolMatches) continue;

          const walletAddressRaw = pickAddress(item.wallet_address) || pickAddress(item.wallet) || pickAddress(item.jetton_wallet) || pickAddress(item.account);
          if (!walletAddressRaw) {
            throw new Error("tgBTC balance found, but TonAPI did not return jetton wallet address");
          }

          const decimals = Number(jetton.decimals ?? item.decimals ?? DECIMALS) || DECIMALS;
          const balanceUnits = String(item.balance ?? item.quantity ?? item.amount ?? "0");
          const jettonWalletAddress = friendly(walletAddressRaw, true);

          // Safety: returned wallet must not be owner or master
          const walletRaw = normalizeRaw(jettonWalletAddress);
          if (walletRaw === normalizeRaw(ownerRaw)) throw new Error("Resolved address equals owner wallet; refusing unsafe burn target");
          if (walletRaw === masterRaw) throw new Error("Resolved address equals tgBTC master; refusing unsafe burn target");

          return asJson(res, 200, {
            success: true,
            source: "tonapi-testnet",
            ownerAddress: friendly(ownerRaw, false),
            masterAddress: friendly(TGBTC_MASTER_RAW, true),
            jettonWalletAddress,
            jettonWalletRaw: walletRaw,
            balanceUnits,
            balanceTgBtc: unitsToDecimal(balanceUnits, decimals),
            decimals,
            symbol: jetton.symbol || item.symbol || "tgBTC",
          });
        }
      } catch (error) {
        lastError = error;
      }
    }

    return asJson(res, 404, {
      success: false,
      error: "tgBTC jetton wallet not found",
      message: lastError ? lastError.message : "No tgBTC balance found for this wallet in TonAPI testnet index.",
      hint: "Make sure the connected wallet is testnet and has tgBTC balance. You can still paste the tgBTC jetton wallet manually if you find it in Tonviewer/Tonkeeper.",
      owner: ownerRaw,
      sampleKeys: lastJson ? Object.keys(lastJson) : []
    });
  } catch (error) {
    return asJson(res, 400, {
      success: false,
      error: "Cannot resolve tgBTC jetton wallet",
      message: error.message,
      hint: "Connect TON testnet wallet first. The address must be a TON testnet account address."
    });
  }
};
