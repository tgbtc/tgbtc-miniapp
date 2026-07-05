const TGBTC_MASTER = "0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074";
const TONAPI = "https://testnet.tonapi.io/v2";

function formatTgBtc(balance) {
  const raw = BigInt(String(balance || "0"));
  const whole = raw / 100000000n;
  const frac = String(raw % 100000000n).padStart(8, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
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

    const url = `${TONAPI}/accounts/${encodeURIComponent(owner)}/jettons/${encodeURIComponent(TGBTC_MASTER)}`;
    const upstream = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "tgbtc-miniapp-resolve-wallet/0.1",
      },
    });
    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(upstream.status === 404 ? 200 : upstream.status).json({
        success: upstream.status === 404,
        owner,
        master: TGBTC_MASTER,
        balance: "0",
        balanceTgBtc: "0",
        walletAddress: "",
        exists: false,
        warning: upstream.status === 404 ? "No tgBTC jetton wallet found for this owner yet." : "TonAPI error",
        details: payload,
      });
    }

    const walletAddress = payload.wallet_address && payload.wallet_address.address;
    const balance = String(payload.balance || "0");

    return res.status(200).json({
      success: true,
      owner,
      master: TGBTC_MASTER,
      balance,
      balanceTgBtc: formatTgBtc(balance),
      walletAddress: walletAddress || "",
      exists: Boolean(walletAddress),
      jetton: payload.jetton || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Resolve jetton wallet error",
      message: error.message,
    });
  }
};
