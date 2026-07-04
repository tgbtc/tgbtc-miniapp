<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>tgBTC Sandbox Explorer</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --panel-2: #f9fafc;
      --text: #142033;
      --muted: #607086;
      --line: #dde4ef;
      --blue: #2563eb;
      --green: #16834a;
      --orange: #c26a14;
      --red: #c43232;
      --purple: #6d4cc2;
      --shadow: 0 8px 24px rgba(22, 32, 51, 0.08);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
    }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .shell {
      width: min(1480px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 40px;
    }

    .topbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .sub {
      color: var(--muted);
      line-height: 1.45;
      max-width: 820px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      min-width: 260px;
    }

    button, .link-button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      min-height: 36px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 650;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 1px 0 rgba(22, 32, 51, 0.02);
    }

    button.primary {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }

    .grid {
      display: grid;
      gap: 12px;
    }

    .cards {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      margin-bottom: 12px;
    }

    .card, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }

    .card {
      padding: 14px;
      min-height: 100px;
    }

    .label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }

    .value {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }

    .hint {
      color: var(--muted);
      margin-top: 8px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.75fr);
      gap: 12px;
      align-items: start;
    }

    .section {
      overflow: hidden;
    }

    .section + .section { margin-top: 12px; }

    .section-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      background: var(--panel-2);
    }

    h2 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0;
    }

    .section-body { padding: 14px 16px; }

    .kv {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 10px 12px;
    }

    .kv .k { color: var(--muted); }
    .kv .v { overflow-wrap: anywhere; font-weight: 650; }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 750;
      font-size: 12px;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .ok { color: var(--green); background: #eaf8ef; border-color: #bfe8cc; }
    .warn { color: var(--orange); background: #fff4e6; border-color: #ffd5a3; }
    .bad { color: var(--red); background: #fff0f0; border-color: #ffc7c7; }
    .info { color: var(--blue); background: #eef4ff; border-color: #cadbff; }
    .purple { color: var(--purple); background: #f3efff; border-color: #d9cff8; }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--panel-2);
      font-weight: 800;
    }

    tbody tr:hover td { background: #fbfdff; }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .bar {
      height: 8px;
      width: 100%;
      border-radius: 999px;
      background: #e7edf6;
      overflow: hidden;
    }

    .bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #16834a, #2563eb);
      width: 0;
    }

    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    pre {
      margin: 0;
      background: #101828;
      color: #dbe7ff;
      border-radius: 8px;
      padding: 12px;
      overflow: auto;
      max-height: 420px;
      font-size: 12px;
      line-height: 1.45;
    }

    details summary {
      cursor: pointer;
      font-weight: 750;
      color: var(--blue);
    }

    .empty, .error {
      padding: 14px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: var(--panel-2);
    }

    .error {
      border-color: #ffc7c7;
      color: var(--red);
      background: #fff6f6;
    }

    .small { font-size: 12px; color: var(--muted); }

    @media (max-width: 1180px) {
      .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 760px) {
      .shell { width: min(100% - 20px, 1480px); padding-top: 14px; }
      .topbar { display: block; }
      .actions { justify-content: flex-start; margin-top: 12px; }
      .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .split { grid-template-columns: 1fr; }
      .kv { grid-template-columns: 1fr; }
      .card { min-height: 90px; }
      table { min-width: 760px; }
      .table-wrap { overflow: auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="topbar">
      <div>
        <h1>tgBTC Sandbox Explorer</h1>
        <div class="sub">
          Визуальный срез testnet/sandbox Teleport BTC: signet Bitcoin, TON testnet contracts, DKG, mint/burn, UTXO, лимиты и живое состояние протокола.
        </div>
      </div>
      <div class="actions">
        <button class="primary" id="refreshBtn" type="button">↻ Обновить</button>
        <a class="link-button" href="https://sandbox.teleport.tg/app/dashboard" target="_blank" rel="noreferrer">Sandbox dashboard</a>
        <a class="link-button" href="https://testnet.tonviewer.com/0:e1177970b722a9422d8ef674b85cdcb2c88295ee397d7150a4a382f91921409c" target="_blank" rel="noreferrer">Teleport Tonviewer</a>
      </div>
    </div>

    <section class="grid cards" id="summaryCards"></section>

    <div class="layout">
      <div>
        <section class="section">
          <div class="section-header">
            <h2>Состояние протокола</h2>
            <span class="small" id="updatedAt">загрузка...</span>
          </div>
          <div class="section-body">
            <div class="split">
              <div class="kv" id="protocolKv"></div>
              <div>
                <div class="label">Готовность testnet door</div>
                <div class="bar"><span id="readinessBar"></span></div>
                <div class="hint" id="readinessText"></div>
                <div style="height: 14px"></div>
                <div class="kv" id="feeKv"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>Последние mint операции</h2>
            <span class="small">из sandbox metrics</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 160px">Время</th>
                  <th style="width: 130px">Сумма</th>
                  <th style="width: 120px">Статус</th>
                  <th>BTC tx</th>
                  <th>TON tx / получатель</th>
                </tr>
              </thead>
              <tbody id="mintsBody"></tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>Последние burn / pegout операции</h2>
            <span class="small">из sandbox metrics</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 160px">Время</th>
                  <th style="width: 130px">Сумма</th>
                  <th style="width: 120px">Статус</th>
                  <th>BTC tx</th>
                  <th>TON tx / отправитель</th>
                </tr>
              </thead>
              <tbody id="burnsBody"></tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>UTXO set Teleport</h2>
            <span class="small">что сейчас обеспечивает tgBTC</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 130px">Amount</th>
                  <th>Tx ID</th>
                  <th style="width: 80px">Index</th>
                  <th>Script</th>
                </tr>
              </thead>
              <tbody id="utxoBody"></tbody>
            </table>
          </div>
        </section>
      </div>

      <aside>
        <section class="section">
          <div class="section-header">
            <h2>Контракты TON testnet</h2>
          </div>
          <div class="section-body">
            <div class="kv" id="contractsKv"></div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>Bitcoin sync</h2>
          </div>
          <div class="section-body">
            <div class="kv" id="bitcoinKv"></div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>DKG</h2>
          </div>
          <div class="section-body">
            <div class="kv" id="dkgKv"></div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>Ключи</h2>
          </div>
          <div class="section-body">
            <div class="kv" id="keysKv"></div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">
            <h2>Сырые данные</h2>
          </div>
          <div class="section-body">
            <details open>
              <summary>protocol info</summary>
              <pre id="rawInfo">загрузка...</pre>
            </details>
            <div style="height: 10px"></div>
            <details>
              <summary>plots summary</summary>
              <pre id="rawPlots">загрузка...</pre>
            </details>
            <div style="height: 10px"></div>
            <details>
              <summary>dkg status</summary>
              <pre id="rawDkg">загрузка...</pre>
            </details>
          </div>
        </section>
      </aside>
    </div>
  </main>

  <script>
    const API =   location.hostname === "127.0.0.1" || location.hostname === "localhost"     ? "/metrics/api"     : "/api/metrics";
    const TONVIEWER = "https://testnet.tonviewer.com/";
    const BTC_EXPLORER = "https://mempool.space/signet/tx/";

    const contracts = {
      tgBTC: "0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074",
      Teleport: "0:e1177970b722a9422d8ef674b85cdcb2c88295ee397d7150a4a382f91921409c",
      Coordinator: "0:f8dd1b5d010fd8f2797ce92ab3c6394bffeac0bdd66204393fb3b39317ea11c6",
      "Bitcoin Client": "0:ae08d68c93ce46b4fd9b8c1301e8987448c687de0594fe4c44f8b201534c9d10",
    };

    const $ = (id) => document.getElementById(id);

    function satsToBtc(value) {
      const n = Number(value || 0);
      return (n / 1e8).toLocaleString("en-US", {
        minimumFractionDigits: 8,
        maximumFractionDigits: 8,
      }) + " BTC";
    }

    function numberFmt(value) {
      const n = Number(value || 0);
      return n.toLocaleString("en-US");
    }

    function shortHash(value, left = 10, right = 8) {
      if (!value) return "—";
      const text = String(value);
      if (text.length <= left + right + 3) return text;
      return `${text.slice(0, left)}...${text.slice(-right)}`;
    }

    function dateFmt(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("ru-RU", { hour12: false });
    }

    function pill(text, kind = "info") {
      return `<span class="pill ${kind}">${text}</span>`;
    }

    function statusKind(text) {
      const value = String(text || "").toUpperCase();
      if (value.includes("SUCCESS") || value.includes("CONFIRMED") || value.includes("FINISHED") || value === "TRUE") return "ok";
      if (value.includes("PROGRESS") || value.includes("PENDING") || value.includes("WAIT")) return "warn";
      if (value.includes("FAIL") || value.includes("ERROR") || value.includes("REFUND")) return "bad";
      return "info";
    }

    function row(k, v) {
      return `<div class="k">${k}</div><div class="v">${v}</div>`;
    }

    function linkTo(url, text, className = "") {
      return `<a class="${className}" href="${url}" target="_blank" rel="noreferrer">${text}</a>`;
    }

    async function fetchSource(source) {
      const response = await fetch(`${API}?source=${encodeURIComponent(source)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
      return response.json();
    }

    function renderCards(info, plots) {
      const teleport = info.ContractTeleport || {};
      const network = info.BitcoinNetworkInfo || {};
      const client = info.ContractBitcoinClient || {};
      const minted = Number(plots.total_minted || 0);
      const burned = Number(plots.total_burned || 0);
      const supply = minted - burned;
      const syncLag = Number(network.Blocks || 0) - Number(client.LastConfirmedBlockHeight || 0);
      const utxoTotal = (teleport.UTXOset || []).reduce((sum, item) => sum + Number(item.Amount || 0), 0);

      const cards = [
        ["Teleport", teleport.Enabled ? "Enabled" : "Disabled", teleport.Enabled ? "Контракт принимает операции" : "Операции выключены", teleport.Enabled ? "ok" : "bad"],
        ["Chain", network.Chain || "—", "Bitcoin network для sandbox", "purple"],
        ["BTC sync lag", numberFmt(syncLag), `network ${numberFmt(network.Blocks)} / client ${numberFmt(client.LastConfirmedBlockHeight)}`, syncLag < 20 ? "ok" : "warn"],
        ["Minted", `${minted.toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC`, `${numberFmt(plots.mints_count)} mint операций`, "info"],
        ["Burned", `${burned.toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC`, `${numberFmt(plots.burns_count)} burn операций`, "warn"],
        ["Supply / UTXO", `${supply.toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC`, `UTXO: ${satsToBtc(utxoTotal)}`, "ok"],
      ];

      $("summaryCards").innerHTML = cards.map(([label, value, hint, kind]) => `
        <article class="card">
          <div class="label">${label}</div>
          <div class="value">${value}</div>
          <div class="hint">${pill(kind.toUpperCase(), kind)} ${hint}</div>
        </article>
      `).join("");
    }

    function renderProtocol(info, plots) {
      const teleport = info.ContractTeleport || {};
      const client = info.ContractBitcoinClient || {};
      const network = info.BitcoinNetworkInfo || {};
      const limits = teleport.Limits || {};
      const minted = Number(plots.total_minted || 0);
      const burned = Number(plots.total_burned || 0);
      const supply = minted - burned;
      const checks = [
        Boolean(teleport.Enabled),
        network.Chain === "signet",
        Number(client.ConfirmationsNeeded || 0) > 0,
        Number(limits.MinPeginAmount || 0) > 0,
        Boolean(teleport.TweakedPubkey),
      ];
      const score = checks.filter(Boolean).length;
      $("readinessBar").style.width = `${(score / checks.length) * 100}%`;
      $("readinessText").innerHTML = `${score}/${checks.length}: ${teleport.Enabled ? "sandbox включен" : "sandbox выключен"}, chain=${network.Chain || "—"}, min pegin=${satsToBtc(limits.MinPeginAmount)}. Для настоящей двери нужен отдельный шаг: корректно сгенерировать signet Taproot deposit address по коду Teleport.`;

      $("protocolKv").innerHTML = [
        row("Environment", pill("Sandbox / TON testnet", "purple")),
        row("Teleport enabled", pill(String(Boolean(teleport.Enabled)), teleport.Enabled ? "ok" : "bad")),
        row("Pegins processing", numberFmt(teleport.PeginsCount)),
        row("Last pegout tx", teleport.LastPegoutTxID ? linkTo(BTC_EXPLORER + teleport.LastPegoutTxID, shortHash(teleport.LastPegoutTxID), "mono") : "—"),
        row("Pegout counter", numberFmt(teleport.PegoutChainCounter)),
        row("Current supply", `${supply.toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC`),
      ].join("");

      $("feeKv").innerHTML = [
        row("Min pegin", satsToBtc(limits.MinPeginAmount)),
        row("Min pegout", satsToBtc(limits.MinPegoutAmount)),
        row("Total service fee", `${numberFmt(teleport.TotalServiceFee)} sats`),
        row("Base fee", `${numberFmt(teleport.BaseSVB)} sat/vByte`),
        row("Next pegout fee", `${numberFmt(teleport.NextSVB)} sat/vByte`),
        row("CSV locktime", numberFmt(teleport.CsvLock)),
      ].join("");
    }

    function renderContracts(info) {
      const teleport = info.ContractTeleport || {};
      const dynamic = {
        tgBTC: teleport.MinterAddress,
        Teleport: teleport.TeleportAddress,
        Coordinator: teleport.CoordinatorAddress,
        "Bitcoin Client": teleport.BitcoinClientAddress,
        Inspector: teleport.InspectorAddress,
        Configurator: teleport.ConfiguratorAddress,
      };

      $("contractsKv").innerHTML = Object.entries({ ...contracts, ...dynamic })
        .filter(([, address]) => address)
        .map(([name, address]) => row(name, linkTo(TONVIEWER + address, `<span class="mono">${address}</span>`)))
        .join("");
    }

    function renderBitcoin(info) {
      const network = info.BitcoinNetworkInfo || {};
      const client = info.ContractBitcoinClient || {};
      const candidates = client.CandidateBlockHashes || [];
      $("bitcoinKv").innerHTML = [
        row("Chain", network.Chain || "—"),
        row("Network height", numberFmt(network.Blocks)),
        row("Best block", `<span class="mono">${network.BestBlockHash || "—"}</span>`),
        row("Client height", numberFmt(client.LastConfirmedBlockHeight)),
        row("Client hash", `<span class="mono">${client.LastConfirmedBlockHash || "—"}</span>`),
        row("Confirmations", numberFmt(client.ConfirmationsNeeded)),
        row("Candidates", candidates.length ? candidates.map((h) => `<div class="mono">${shortHash(h, 14, 10)}</div>`).join("") : "—"),
      ].join("");
    }

    function renderDkg(dkg) {
      const current = dkg.DkgInfo || {};
      const prev = dkg.PrevDkgInfo || {};
      $("dkgKv").innerHTML = [
        row("Standalone mode", pill(String(Boolean(dkg.StandaloneMode)), dkg.StandaloneMode ? "warn" : "ok")),
        row("Current state", pill(current.State || "—", statusKind(current.State))),
        row("VSet size", numberFmt(current.VSetSize)),
        row("Max validators", numberFmt(current.ValidatorsCountMax)),
        row("In DKG", numberFmt(current.ValidatorsCountInDkg)),
        row("Not in DKG", numberFmt(current.ValidatorsCountNotInDkg)),
        row("Evicted", numberFmt(current.ValidatorsCountEvicted)),
        row("Previous state", pill(prev.State || "—", statusKind(prev.State))),
      ].join("");
    }

    function renderKeys(info) {
      const teleport = info.ContractTeleport || {};
      $("keysKv").innerHTML = [
        row("Tweaked key", `<span class="mono">${teleport.TweakedPubkey || "—"}</span>`),
        row("Internal key", `<span class="mono">${teleport.InternalKey || "—"}</span>`),
        row("Locktime", numberFmt(teleport.CsvLock)),
        row("Last pegout tx", teleport.LastPegoutTxID ? `<span class="mono">${teleport.LastPegoutTxID}</span>` : "—"),
      ].join("");
    }

    function renderUtxo(info) {
      const utxos = (info.ContractTeleport && info.ContractTeleport.UTXOset) || [];
      if (!utxos.length) {
        $("utxoBody").innerHTML = `<tr><td colspan="4"><div class="empty">UTXO пока нет.</div></td></tr>`;
        return;
      }
      $("utxoBody").innerHTML = utxos.map((item) => `
        <tr>
          <td>${satsToBtc(item.Amount)}</td>
          <td>${linkTo(BTC_EXPLORER + item.Address, `<span class="mono">${item.Address}</span>`)}</td>
          <td>${numberFmt(item.Index)}</td>
          <td class="mono">${item.Script || "—"}</td>
        </tr>
      `).join("");
    }

    function opAmount(op) {
      return op.AmountBTC || op.Amount || op.amount || op.Value || op.value || "—";
    }

    function opStatus(op) {
      return op.Status || op.status || op.pegout_status || op.PegoutStatus || op.State || op.state || "—";
    }

    function opTime(op) {
      return op.UpdatedAt || op.CreatedAt || op.Time || op.time || op.created_at || op.Date || op.date;
    }

    function opBtcTx(op) {
      return op.BitcoinTxID || op.BitcoinTxId || op.bitcoin_tx_id || op.BtcTxID || op.BtcTxId || op.TxID || op.txid || op.TransactionID || op.transaction_id;
    }

    function opTonTx(op) {
      return op.TonTxHash || op.TonTxID || op.TonTxId || op.ton_tx || op.TransactionHash || op.TxHash || op.receiver_addr || op.sender_addr || op.ReceiverAddress || op.SenderAddress || op.TonAddress;
    }

    function renderOps(targetId, list) {
      const rows = Array.isArray(list) ? list.slice(0, 30) : [];
      if (!rows.length) {
        $(targetId).innerHTML = `<tr><td colspan="5"><div class="empty">Нет данных.</div></td></tr>`;
        return;
      }

      $(targetId).innerHTML = rows.map((op) => {
        const status = opStatus(op);
        const btcTx = opBtcTx(op);
        const tonTx = opTonTx(op);
        return `
          <tr>
            <td>${dateFmt(opTime(op))}</td>
            <td>${opAmount(op)}</td>
            <td>${pill(status, statusKind(status))}</td>
            <td>${btcTx ? linkTo(BTC_EXPLORER + btcTx, `<span class="mono">${shortHash(btcTx)}</span>`) : "—"}</td>
            <td>${tonTx ? `<span class="mono">${shortHash(tonTx, 16, 10)}</span>` : "—"}</td>
          </tr>
        `;
      }).join("");
    }

    function showError(error) {
      $("summaryCards").innerHTML = `<article class="card" style="grid-column: 1 / -1"><div class="error">Не удалось загрузить sandbox metrics: ${error.message}</div><div class="hint">Проверь доступность ${API}?source=info</div></article>`;
    }

    async function load() {
      $("updatedAt").textContent = "загрузка...";
      try {
        const [info, plots, dkg, mints, burns] = await Promise.all([
          fetchSource("info"),
          fetchSource("plots_summary"),
          fetchSource("dkg_status"),
          fetchSource("mints"),
          fetchSource("burns"),
        ]);

        renderCards(info, plots);
        renderProtocol(info, plots);
        renderContracts(info);
        renderBitcoin(info);
        renderDkg(dkg);
        renderKeys(info);
        renderUtxo(info);
        renderOps("mintsBody", mints);
        renderOps("burnsBody", burns);

        $("rawInfo").textContent = JSON.stringify(info, null, 2);
        $("rawPlots").textContent = JSON.stringify(plots, null, 2);
        $("rawDkg").textContent = JSON.stringify(dkg, null, 2);
        $("updatedAt").textContent = `обновлено: ${new Date().toLocaleString("ru-RU", { hour12: false })}`;
      } catch (error) {
        showError(error);
        $("updatedAt").textContent = "ошибка загрузки";
        console.error(error);
      }
    }

    $("refreshBtn").addEventListener("click", load);
    load();
  </script>
</body>
</html>
