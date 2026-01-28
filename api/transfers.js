export default async function handler(req, res) {
  const MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";

  const url =
    "https://testnet.toncenter.com/api/v3/jetton/transfers" +
    `?jetton_master=${MASTER}&limit=20&sort=desc`;

  const r = await fetch(url,{
    headers:{
      "X-API-Key": process.env.TONCENTER_TESTNET_API_KEY
    }
  });

  const j = await r.json();

  const out = j.items.map(t=>({
    utime: t.utime,
    from: t.from,
    to: t.to,
    amount: t.amount
  }));

  res.setHeader("Cache-Control","no-store");
  res.json(out);
}
