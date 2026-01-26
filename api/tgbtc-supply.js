// Vercel Serverless Function (Node.js)
// URL будет: /api/tgbtc-supply

export default async function handler(req, res) {
  try {
    // CORS (если Mini App будет открываться с домена Telegram/других доменов)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const network = (process.env.TON_NETWORK || "testnet").toLowerCase();
    const master = process.env.JETTON_MASTER;
    const decimals = Number(process.env.JETTON_DECIMALS || 0);

    if (!master) {
      return res.status(400).json({ ok: false, error: "JETTON_MASTER missing" });
    }

    const base = network === "mainnet" ? "https://toncenter.com" : "https://testnet.toncenter.com";
    const apiKey =
      network === "mainnet"
        ? (process.env.TONCENTER_API_KEY_MAINNET || "")
        : (process.env.TONCENTER_API_KEY_TESTNET || "");

    const url = `${base}/api/v2/runGetMethod`;

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;

    const payload = {
      address: master,
      method: "get_jetton_data",
      stack: [],
    };

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    const result = j?.result || j;
    const exit = result?.exit_code;
    const stack = result?.stack;

    if (!r.ok || !result || exit !== 0 || !Array.isArray(stack) || stack.length === 0) {
      return res.status(502).json({
        ok: false,
        error: "TON Center bad response",
        status: r.status,
        exit_code: exit,
        raw: j,
      });
    }

    // get_jetton_data returns: (total_supply, mintable, admin_address, content, wallet_code)
    const first = stack[0];
    let supplyRawStr = null;

    // Typical toncenter stack element: ["num","0x..."] or ["num","123"]
    if (Array.isArray(first) && first.length >= 2) supplyRawStr = String(first[1]);
    else if (first && typeof first === "object") supplyRawStr = String(first.value ?? "");

    if (!supplyRawStr) {
      return res.status(502).json({ ok: false, error: "Cannot parse supply", raw: j });
    }

    const raw = (supplyRawStr.startsWith("0x") || supplyRawStr.startsWith("-0x"))
      ? BigInt(supplyRawStr)
      : BigInt(supplyRawStr);

    const formatUnits = (bi, dec) => {
      const neg = bi < 0n;
      const x = neg ? -bi : bi;
      if (dec === 0) return (neg ? "-" : "") + x.toString();
      const base10 = 10n ** BigInt(dec);
      const i = x / base10;
      const f = x % base10;
      const frac = f.toString().padStart(dec, "0").replace(/0+$/, "");
      return (neg ? "-" : "") + i.toString() + (frac ? "." + frac : "");
    };

    return res.status(200).json({
      ok: true,
      network,
      jetton_master: master,
      supply_raw: raw.toString(),
      supply: formatUnits(raw, decimals),
      decimals,
      symbol: "tgBTC",
      source: "toncenter runGetMethod(get_jetton_data)",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
