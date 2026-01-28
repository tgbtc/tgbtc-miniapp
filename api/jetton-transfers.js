export default async function handler(req, res) {
  try {
    const owner = String(req.query.owner || "").trim();
    const master = String(req.query.master || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    if (!owner || !master) {
      return res.status(400).json({ ok: false, error: "owner and master are required" });
    }

    const API_KEY = process.env.TONCENTER_TESTNET_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "Missing env TONCENTER_TESTNET_API_KEY" });
    }

    // v3 jetton transfers: owner_address + jetton_master (+ limit, sort)
    // /api/v3/jetton/transfers существует в TON Center v3. :contentReference[oaicite:4]{index=4}
    const url = new URL("https://testnet.toncenter.com/api/v3/jetton/transfers");
    url.searchParams.set("owner_address", owner);
    url.searchParams.set("jetton_master", master);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    url.searchParams.set("sort", "desc");

    const r = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "X-API-Key": API_KEY, // :contentReference[oaicite:5]{index=5}
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
