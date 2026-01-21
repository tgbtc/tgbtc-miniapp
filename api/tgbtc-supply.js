export default async function handler(req, res) {
  try {
    const key = process.env.TONAPI_KEY;
    const master = process.env.TGBTC_JETTON_MASTER;

    if (!key) return res.status(500).json({ ok: false, error: "TONAPI_KEY missing" });
    if (!master) return res.status(500).json({ ok: false, error: "TGBTC_JETTON_MASTER missing" });

    const r = await fetch(`https://tonapi.io/v2/jettons/${encodeURIComponent(master)}`, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
      cache: "no-store",
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data) {
      return res.status(502).json({ ok: false, error: "TonAPI jetton failed", status: r.status, details: data });
    }

    const totalRaw = data?.total_supply ?? data?.supply ?? null;
    const decimals = Number(data?.metadata?.decimals ?? data?.decimals ?? 0);

    // string -> human
    let human = null;
    if (typeof totalRaw === "string" && /^\d+$/.test(totalRaw)) {
      const s = totalRaw;
      const d = Number.isFinite(decimals) ? decimals : 0;
      if (d === 0) human = s;
      else {
        const pad = s.padStart(d + 1, "0");
        const intPart = pad.slice(0, -d);
        const fracPart = pad.slice(-d).replace(/0+$/, "");
        human = fracPart ? `${intPart}.${fracPart}` : intPart;
      }
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.json({
      ok: true,
      total_supply: human ?? totalRaw,
      total_supply_raw: totalRaw,
      decimals,
      source: "tonapi:/v2/jettons/{master}",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
