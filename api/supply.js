export default async function handler(req, res) {
  const MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";

  const r = await fetch(
    `https://testnet.toncenter.com/api/v3/jettons/${MASTER}`,
    {
      headers:{
        "X-API-Key": process.env.TONCENTER_TESTNET_API_KEY
      }
    }
  );

  const j = await r.json();
  res.setHeader("Cache-Control","no-store");
  res.json({
    total_supply: j.total_supply
  });
}
