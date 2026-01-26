// /api/tgbtc-supply.js
// Vercel Serverless Function (Node.js)
// Endpoint: /api/tgbtc-supply

export default async function handler(req, res) {
  try {
    // CORS (на всякий случай для Mini App)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();

    const network = (process.env.TON_NETWORK || "testnet").toLowerCase(); // "testnet" | "mainnet"
    const master = process.env.JETTON_MASTER;
    const decimals = Number(process.env.JETTON_DECIMALS || 0);

    if (!master) {
      return res.status(400).json({
        ok: false,
        error: "JETTON_MASTER missing",
        debug: { network, has_key_testnet: !!process.env.TONCENTER_API_KEY_TESTNET, has_key_mainnet: !!process.env.TONCENTER_API_KEY_MAINNET }
      });
    }

    const base = network === "mainnet" ? "https://toncenter.com" : "https://testnet.toncenter.com";
    const apiKey =
      network === "mainnet"
        ? (process.env.TONCENTER_API_KEY_MAINNET || "")
        : (process.env.TONCENTER_API_KEY_TESTNET || "");

    // ВАЖНО: используем v3 — он стабильнее для runGetMethod и другой формат stack
    const url = `${base}/api/v3/runGetMethod`;

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;

    // get_jetton_data -> (total_supply, mintable, admin, content, wallet_code)
    const payload = {
      address: master,
      method: "get_jetton_data",
      stack: [] // пустой стек
    };

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const j = await r.json().catch(() => null);

    // v3 обычно возвращает exit_code и stack прямо в корне ответа
    const exit = j?.exit_code;
    const stack = j?.stack;

    if (!r.ok || !j || exit !== 0 || !Array.isArray(stack) || stack.length === 0) {
      return res.status(502).json({
        ok: false,
        error: "TON Center bad response",
        status: r.status,
        debug: {
          network,
          base,
          used_endpoint: "/api/v3/runGetMethod",
          master,
          exit_code: exit,
        },
        raw: j,
      });
    }

    // В v3 элемент может быть:
    // - { "type":"num", "value":"0x..." }  (часто)
    // - или ["num","0x..."] (иногда)
    const first = stack[0];

    let supplyRawStr = null;

    if (first && typeof first === "object" && !Array.isArray(first)) {
      supplyRawStr = String(first.value ?? "");
    } else if (Array.isArray(first) && first.length >= 2) {
      supplyRawStr = String(first[1]);
    }

    if (!supplyRawStr) {
      return res.status(502).json({
        ok: false,
        error: "Cannot parse supply from stack",
        debug: { network, master, first },
        raw: j,
      });
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

    // можно чуть кэшировать на edge (экономит вызовы)
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");

    return res.status(200).json({
      ok: true,
      network,
      jetton_master: master,
      supply_raw: raw.toString(),
      supply: formatUnits(raw, decimals),
      decimals,
      symbol: "tgBTC",
      source: "toncenter v3 runGetMethod(get_jetton_data)",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
