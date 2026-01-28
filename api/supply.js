export default async function handler(req, res) {
  const MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";

  const r = await fetch(
    "https://testnet.toncenter.com/api/v2/runGetMethod",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.TONCENTER_TESTNET_API_KEY
      },
      body: JSON.stringify({
        address: MASTER,
        method: "get_jetton_data",
        stack: []
      })
    }
  );

  const j = await r.json();

  // stack[0] = total_supply
  let raw = j.result.stack[0][1];

  // hex → decimal
  if (typeof raw === "string" && raw.startsWith("0x")) {
    raw = BigInt(raw).toString();
  }

  res.json({ total_supply: raw });
}
