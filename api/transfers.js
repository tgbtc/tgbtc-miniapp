export default async function handler(req, res) {
  const MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";

  const url =
    "https://testnet.toncenter.com/api/v2/getTransactions" +
    `?address=${MASTER}&limit=5`;

  const r = await fetch(url, {
    headers: {
      "X-API-Key": process.env.TONCENTER_TESTNET_API_KEY
    }
  });

  const j = await r.json();

  const out = j.result.map(tx => ({
    utime: tx.utime,
    hash: tx.transaction_id.hash
  }));

  res.json(out);
}
