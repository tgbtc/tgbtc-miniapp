const NETWORKS = {
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet / Prod',
    environment: 'prod',
    maintenance: '1',
    metricsApi: 'https://teleport.tg/metrics/api',
    indexer: 'https://teleport.tg/indexer/graphql',
    tonCenter: 'https://toncenter.com',
    tonApi: 'https://tonapi.io/v2',
    btcExplorer: 'https://mempool.space',
    btcNetwork: 'bitcoin',
    minter: 'EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU',
    minterRaw: '0:668f1a58b09f321c4ada61f4e92dd7a309e907328292d9f384acfe252c709fe1',
    teleport: 'EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-',
    teleportRaw: '0:baa3e462e10dd1dc5d7139368f6b067deb88aa85add3cc91809a98bc8785ea70',
    coordinator: 'Ef_q19o4m94xfF-yhYB85Qe6rTHDX-VTSzxBh4XpAfZMaOvk',
    bitclient: 'EQC8zTEAt9BjhteymRnOq8hK7AuUnseB1xPNHjreCZswNFj2',
    bitclientRaw: '0:bccd3100b7d06386d7b29919ceabc84aec0b949ec781d713cd1e3ade099b3034',
    bitcoinRpc: 'https://bitcoin-rpc.publicnode.com',
    readOnly: true
  },
  testnet: {
    id: 'testnet',
    label: 'Sandbox / Testnet',
    environment: 'sand',
    maintenance: '0',
    metricsApi: 'https://sandbox.teleport.tg/metrics/api',
    indexer: 'https://sandbox.teleport.tg/indexer/graphql',
    tonCenter: 'https://testnet.toncenter.com',
    tonApi: 'https://testnet.tonapi.io/v2',
    btcExplorer: 'https://mempool.space/signet',
    btcNetwork: 'signet',
    minter: 'EQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdLub',
    minterRaw: '0:b120dbb01adb29027ca740729c9e156bd86c1e624459b1b28d5b45ed68738074',
    teleport: 'EQDhF3lwtyKpQi2O9nS4XNyyyIKV7jl9cVCko4L5GSFAnHRo',
    teleportRaw: '0:e1177970b722a9422d8ef674b85cdcb2c88295ee397d7150a4a382f91921409c',
    coordinator: 'EQD43RtdAQ_Y8nl86SqzxjlL_-rAvdZiBDk_s7OTF-oRxmwo',
    bitclient: 'EQCuCNaMk85GtP2bjBMB6Jh0SMaH3gWU_kxE-LIBU0ydEJUt',
    bitcoinRpc: 'https://bitcoin-rpc.ton-teleport.rsquad.solutions/',
    readOnly: false
  }
};

const ALLOWED_SOURCES = new Set(['info', 'plots_summary', 'dkg_status', 'mints', 'burns', 'reinits', 'internal_keys', 'system_info', 'alerts', 'config']);
const ARRAY_SOURCES = new Set(['mints', 'burns', 'reinits', 'internal_keys', 'alerts']);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function selectNetwork(value) {
  return value === 'testnet' || value === 'sand' || value === 'sandbox' ? NETWORKS.testnet : NETWORKS.mainnet;
}

function headers(extra = {}) {
  return {
    accept: 'application/json',
    'user-agent': 'tgbtc-mainnet-real-first-explorer/1.2',
    ...extra,
  };
}

async function fetchText(url, timeoutMs = 20000, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

function safeJson(text) {
  try { return text ? JSON.parse(text) : null; } catch { return { raw: text }; }
}

function looksLikeHtml(payload) {
  if (!payload) return false;
  if (typeof payload.raw === 'string' && /<!doctype|<html|<body/i.test(payload.raw)) return true;
  return false;
}

async function proxyMetrics(cfg, source, limit) {
  const targetUrl = new URL(cfg.metricsApi);
  targetUrl.searchParams.set('source', source);
  const { response, text } = await fetchText(targetUrl.toString(), 20000, { headers: headers() });
  let payload = safeJson(text);
  if (!response.ok || looksLikeHtml(payload)) {
    const err = new Error(`metrics API ${response.status}`);
    err.status = response.status;
    err.payload = payload;
    err.url = targetUrl.toString();
    throw err;
  }
  if (ARRAY_SOURCES.has(source) && Array.isArray(payload)) payload = payload.slice(0, limit);
  return payload;
}

async function getTonApi(cfg, path, params = {}) {
  const url = new URL(`${cfg.tonApi}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const h = headers();
  if (process.env.TONAPI_KEY && cfg.id === 'mainnet') h.authorization = `Bearer ${process.env.TONAPI_KEY}`;
  const { response, text } = await fetchText(url.toString(), 20000, { headers: h });
  const body = safeJson(text);
  if (!response.ok) return { ok: false, status: response.status, url: url.toString(), body };
  return { ok: true, status: response.status, url: url.toString(), body };
}

async function postGraphql(cfg, query) {
  try {
    const { response, text } = await fetchText(cfg.indexer, 12000, {
      method: 'POST',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ query })
    });
    const body = safeJson(text);
    return { ok: response.ok, status: response.status, url: cfg.indexer, body };
  } catch (error) {
    return { ok: false, status: 0, url: cfg.indexer, body: { error: error.message } };
  }
}

async function getBitcoinHeight(cfg) {
  try {
    const url = `${cfg.btcExplorer}/api/blocks/tip/height`;
    const { response, text } = await fetchText(url, 8000, { headers: { accept: 'text/plain', 'user-agent': 'tgbtc-switch-height/1.2' } });
    if (!response.ok) return null;
    const h = Number.parseInt(text, 10);
    return Number.isFinite(h) ? h : null;
  } catch { return null; }
}

function eventList(eventsBody) {
  const body = eventsBody || {};
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.events)) return body.events;
  if (Array.isArray(body.traces)) return body.traces;
  return [];
}

function actionTitle(action) {
  return String(action.type || action.action_type || action.simple_preview?.name || action.simple_preview?.description || 'ACTION');
}

function actionValue(action) {
  const simple = action.simple_preview || {};
  const byType = action.JettonMint || action.JettonBurn || action.JettonTransfer || action[action.type] || {};
  return simple.value || byType.amount || byType.jetton_amount || byType.amount_str || byType.value || '';
}

function actionAddress(action) {
  const simple = action.simple_preview || {};
  const byType = action.JettonMint || action.JettonBurn || action.JettonTransfer || action[action.type] || {};
  const accounts = simple.accounts || [];
  return accounts[0]?.address || byType.sender?.address || byType.recipient?.address || byType.owner?.address || byType.wallet?.address || '';
}

function normalizeActions(eventsBody, sourceName) {
  const events = eventList(eventsBody);
  const rows = [];
  for (const event of events) {
    const actions = Array.isArray(event.actions) ? event.actions : [];
    if (!actions.length) {
      rows.push({
        type: 'TRANSACTION',
        source: sourceName,
        timestamp: event.timestamp || event.utime || event.now,
        event_id: event.event_id || event.trace_id || event.hash || '',
        status: event.is_scam ? 'WARN' : (event.success === false ? 'FAILED' : 'CONFIRMED'),
        amount: '',
        account: '',
        raw: event
      });
      continue;
    }
    for (const action of actions) {
      rows.push({
        type: actionTitle(action),
        source: sourceName,
        timestamp: event.timestamp || event.utime || event.now,
        event_id: event.event_id || event.trace_id || event.hash || '',
        status: action.status || (action.success === false ? 'FAILED' : 'CONFIRMED'),
        amount: actionValue(action),
        account: actionAddress(action),
        raw: action
      });
    }
  }
  return rows;
}

function toTokenAmount(raw, decimals) {
  const n = Number(raw || 0);
  if (!Number.isFinite(n)) return null;
  return n / (10 ** decimals);
}

function accountActive(account) {
  const body = account?.body || account || {};
  return Boolean(body.status === 'active' || body.is_active || body.interfaces || body.balance !== undefined);
}

async function fallbackData(cfg, source, limit) {
  const [jetton, holders, minterAccount, teleportAccount, bitclientAccount, minterEvents, teleportEvents, minterTx, teleportTx, bitcoinHeight, gqlPing] = await Promise.all([
    getTonApi(cfg, `/jettons/${encodeURIComponent(cfg.minter)}`),
    getTonApi(cfg, `/jettons/${encodeURIComponent(cfg.minter)}/holders`, { limit, offset: 0 }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.minter)}`),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.teleport)}`),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.bitclient)}`),
    getTonApi(cfg, `/accounts/${encodeURIComponent(cfg.minter)}/events`, { limit }),
    getTonApi(cfg, `/accounts/${encodeURIComponent(cfg.teleport)}/events`, { limit }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.minter)}/transactions`, { limit }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.teleport)}/transactions`, { limit }),
    getBitcoinHeight(cfg),
    postGraphql(cfg, '{ __typename }')
  ]);

  const jettonBody = jetton.ok ? jetton.body : {};
  const holdersBody = holders.ok ? holders.body : {};
  const decimals = Number(jettonBody.metadata?.decimals || jettonBody.decimals || 8);
  const rawSupply = jettonBody.total_supply || jettonBody.totalSupply || jettonBody.supply || 0;
  const supplyNum = toTokenAmount(rawSupply, decimals);
  const holdersCount = holdersBody.total || holdersBody.holders?.length || holdersBody.addresses?.length || 0;

  const allActions = [
    ...normalizeActions(minterEvents.ok ? minterEvents.body : null, 'minter'),
    ...normalizeActions(teleportEvents.ok ? teleportEvents.body : null, 'teleport')
  ].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

  const mints = allActions.filter((r) => /mint/i.test(r.type)).map((r) => ({
    created_at: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : undefined,
    amount: r.amount || 'mint',
    status: r.status,
    ton_tx: r.event_id,
    receiver_addr: r.account,
    source: r.source,
    raw: r.raw
  }));

  const burns = allActions.filter((r) => /burn|pegout|withdraw|contract called|call contract/i.test(r.type)).map((r) => ({
    created_at: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : undefined,
    amount: r.amount || r.type,
    pegout_status: r.status,
    ton_tx: r.event_id,
    sender_addr: r.account,
    source: r.source,
    raw: r.raw
  }));

  const fullMetricsMissing = true;
  const activeMinter = accountActive(minterAccount);
  const activeTeleport = accountActive(teleportAccount);

  const info = {
    Fallback: true,
    ChainOnly: true,
    DataMode: 'CHAIN_ONLY_TONAPI',
    FallbackReason: cfg.id === 'mainnet' ? 'MAINNET_REAL_MODE: prod metrics are ignored because the public prod metrics endpoint can return sandbox/signet data. This screen uses real TON mainnet contract data only; unknown protocol internals are left null, not guessed.' : 'Official full metrics API did not return this source. Data is shown from TON contract data via TonAPI plus public Bitcoin height. Unknown protocol internals are left null, not guessed.',
    Environment: cfg.environment,
    MaintenanceMode: cfg.maintenance,
    ReadOnly: cfg.readOnly,
    ContractTeleport: {
      Enabled: activeTeleport,
      BridgeSendEnabled: false,
      MinterAddress: cfg.minterRaw || cfg.minter,
      TeleportAddress: cfg.teleportRaw || cfg.teleport,
      CoordinatorAddress: cfg.coordinator,
      BitcoinClientAddress: cfg.bitclientRaw || cfg.bitclient,
      Limits: { MinPeginAmount: null, MinPegoutAmount: null },
      UTXOset: null,
      PeginsCount: null,
      TotalServiceFee: null,
      BaseSVB: null,
      NextSVB: null,
      CsvLock: null,
      PegoutCounter: null,
      TweakedPubkey: null,
      InternalKey: null,
      LastPegoutTxID: null
    },
    BitcoinNetworkInfo: { Chain: cfg.btcNetwork, Blocks: bitcoinHeight, BestBlockHash: '' },
    ContractBitcoinClient: { LastConfirmedBlockHeight: null, LastConfirmedBlockHash: '', ConfirmationsNeeded: cfg.id === 'mainnet' ? 6 : 2 },
    Jetton: jettonBody,
    JettonSummary: {
      active: activeMinter,
      supply: supplyNum,
      rawSupply,
      decimals,
      holders: holdersCount,
      symbol: jettonBody.metadata?.symbol || jettonBody.symbol || 'tgBTC',
      name: jettonBody.metadata?.name || jettonBody.name || 'tgBTC'
    },
    Accounts: { minter: minterAccount, teleport: teleportAccount, bitclient: bitclientAccount },
    IndexerGraphql: gqlPing,
    Notes: [
      'Mainnet default is read-only while official prod config has MAINTENANCE_MODE=1.',
      'BTC client lag, DKG, reserve UTXO and service fee require the official full metrics endpoint. They are not guessed in chain-only mode.'
    ]
  };

  const plots = {
    fallback: true,
    chain_only: true,
    total_minted: Number.isFinite(supplyNum) ? supplyNum : 0,
    total_burned: 0,
    mints_count: mints.length,
    burns_count: burns.length,
    holders_count: holdersCount,
    total_supply: Number.isFinite(supplyNum) ? supplyNum : 0
  };

  const dkg = {
    fallback: true,
    chain_only: true,
    StandaloneMode: null,
    DkgInfo: {
      State: 'NOT_EXPOSED',
      VSetSize: null,
      ValidatorsCountMax: null,
      ValidatorsCountInDkg: null,
      ValidatorsCountNotInDkg: null,
      ValidatorsCountEvicted: null
    },
    Note: 'DKG/signers state is not visible from TonAPI events. Need full Teleport metrics API for exact mainnet DKG.'
  };

  const alerts = [
    { level: 'warn', message: `${cfg.label}: official prod config maintenance=${cfg.maintenance}; bridge sending is disabled in this app.` },
    ...(cfg.id === 'mainnet' ? [{ level: 'info', message: 'Mainnet is forced to real on-chain mode. Sandbox/signet metrics are ignored so the screen does not show false mainnet values.' }] : []),
    ...(fullMetricsMissing ? [{ level: 'info', message: 'Full protocol internals not exposed by this source; visible values are on-chain mainnet data.' }] : [])
  ];

  const system = {
    network: cfg,
    tonapi: { jetton, holders, minterAccount, teleportAccount, bitclientAccount, minterEvents, teleportEvents, minterTx, teleportTx },
    graphql: gqlPing
  };

  if (source === 'info') return info;
  if (source === 'plots_summary') return plots;
  if (source === 'dkg_status') return dkg;
  if (source === 'mints') return mints.slice(0, limit);
  if (source === 'burns') return burns.slice(0, limit);
  if (source === 'alerts') return alerts;
  if (source === 'system_info') return system;
  if (source === 'reinits' || source === 'internal_keys') return [];
  return { info, plots, dkg, mints, burns, alerts, system };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const source = String(req.query.source || 'info');
  const limit = parseLimit(req.query.limit);
  const cfg = selectNetwork(req.query.network);

  if (!ALLOWED_SOURCES.has(source)) return res.status(400).json({ success: false, error: 'Invalid source', allowed: Array.from(ALLOWED_SOURCES) });
  if (source === 'config') return res.status(200).json({ success: true, network: cfg.id, config: cfg, networks: NETWORKS });

  try {
    // IMPORTANT: prod metrics endpoint may currently return sandbox/signet payloads.
    // Mainnet must never display sandbox values. For mainnet we use verified TON mainnet
    // contract data only (TonAPI + public Bitcoin height) until official prod metrics
    // exposes matching mainnet internals. Testnet still uses sandbox full metrics.
    if (cfg.id === 'mainnet') {
      const fallback = await fallbackData(cfg, source, limit);
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
      return res.status(200).send(JSON.stringify(fallback));
    }

    try {
      const payload = await proxyMetrics(cfg, source, limit);
      const cacheSeconds = ARRAY_SOURCES.has(source) ? 20 : 10;
      res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=40`);
      return res.status(200).send(JSON.stringify(payload));
    } catch (upstreamError) {
      const fallback = await fallbackData(cfg, source, limit);
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
      return res.status(200).send(JSON.stringify(fallback));
    }
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(isTimeout ? 504 : 500).json({ success: false, network: cfg.id, config: cfg, error: isTimeout ? 'Proxy timeout' : 'Proxy error', message: error.message });
  }
};
