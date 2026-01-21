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
      return res.status(502).json({
        ok: false,
        error: "TonAPI jetton fetch failed",
        status: r.status,
        details: data,
      });
    }

    // TonAPI обычно возвращает total_supply строкой (иногда очень большой)
    const total_supply = data?.total_supply ?? data?.supply ?? null;
    const decimals = Number(data?.metadata?.decimals ?? data?.decimals ?? 0);

    // Нормализуем в “человеческий” формат, если supply строкой
    let total_supply_human = null;
    if (typeof total_supply === "string" && /^\d+$/.test(total_supply) && Number.isFinite(decimals)) {
      // безопасно: делаем строковое деление
      const s = total_supply;
      const d = decimals;

      if (d === 0) total_supply_human = s;
      else {
        const pad = s.padStart(d + 1, "0");
        const intPart = pad.slice(0, -d);
        const fracPart = pad.slice(-d).replace(/0+$/, "");
        total_supply_human = fracPart ? `${intPart}.${fracPart}` : intPart;
      }
    } else if (typeof total_supply === "number") {
      total_supply_human = String(total_supply);
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.json({
      ok: true,
      jetton_master: master,
      total_supply_raw: total_supply,
      decimals,
      total_supply: total_supply_human ?? total_supply, // то, что ты показываешь в UI
      source: "tonapi",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
