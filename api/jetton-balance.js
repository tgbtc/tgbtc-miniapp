export default async function handler(req, res) {
  try {
    const owner = String(req.query.owner || "").trim();
    const master = String(req.query.master || "").trim();

    if (!owner || !master) {
      return res.status(400).json({ ok: false, error: "owner and master are required" });
    }

    const API_KEY = process.env.TONCENTER_TESTNET_API_KEY; // положишь в Vercel Env
    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "Missing env TONCENTER_TESTNET_API_KEY" });
    }

    // v3 jetton wallets: фильтр по owner_address + jetton_address (master)
    // /api/v3/jetton/wallets существует в TON Center v3. :contentReference[oaicite:2]{index=2}
    const url = new URL("https://testnet.toncenter.com/api/v3/jetton/wallets");
    url.searchParams.set("owner_address", owner);
    url.searchParams.set("jetton_address", master);
    url.searchParams.set("limit", "1");
    url.searchParams.set("offset", "0");

    const r = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "X-API-Key": API_KEY, // TON Center принимает X-API-Key :contentReference[oaicite:3]{index=3}
      },
    });

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data?.error || data?.message || text });
    }

    return res.status(200).json(data ?? { ok: false, error: "Empty response" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
