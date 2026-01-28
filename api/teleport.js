export default async function handler(req, res) {
  try {
    const MAIN_JS = "https://sandbox.teleport.tg/assets/index-CIBtguVa.js";

    const r = await fetch(MAIN_JS, {
      headers: { "user-agent": "Mozilla/5.0", "accept": "*/*" }
    });
    const js = await r.text();

    function snippet(needle, radius = 450) {
      const i = js.indexOf(needle);
      if (i === -1) return null;
      const start = Math.max(0, i - radius);
      const end = Math.min(js.length, i + needle.length + radius);
      return js.slice(start, end);
    }

    // 1) Сниппет вокруг jsonRPC
    const s1 = snippet("/api/v2/jsonRPC");

    // 2) Сниппеты вокруг путей, которые похожи на “создать/обновить креды депозита”
    const s2 = snippet("deposit/creds/new");
    const s3 = snippet("deposit/creds");
    const s4 = snippet("/mints");

    // 3) Попробуем ещё найти слова “updated”, “address”, “timer” — часто в коде они есть
    const s5 = snippet("updated in");
    const s6 = snippet("address will be updated");
    const s7 = snippet("tb1");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      note: "snippets",
      jsonRPC: s1,
      deposit_creds_new: s2,
      deposit_creds: s3,
      mints: s4,
      updated_in: s5,
      address_updated: s6,
      tb1: s7
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e) });
  }
}
