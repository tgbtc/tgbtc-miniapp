const NETWORKS = {
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
    bitcoinRpc: 'https://bitcoin-rpc.ton-teleport.rsquad.solutions/'
  },
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
    bitcoinRpc: 'https://bitcoin-rpc.publicnode.com'
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
  return value === 'mainnet' || value === 'prod' || value === 'main' ? NETWORKS.mainnet : NETWORKS.testnet;
}

function headers(extra = {}) {
  return {
    accept: 'application/json',
    'user-agent': 'tgbtc-mainnet-testnet-switch/1.0',
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

async function proxyMetrics(cfg, source, limit) {
  const targetUrl = new URL(cfg.metricsApi);
  targetUrl.searchParams.set('source', source);
  const { response, text } = await fetchText(targetUrl.toString(), 20000, { headers: headers() });
  let payload = safeJson(text);
  if (!response.ok) {
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

async function getBitcoinHeight(cfg) {
  try {
    const url = `${cfg.btcExplorer}/api/blocks/tip/height`;
    const { response, text } = await fetchText(url, 8000, { headers: { accept: 'text/plain', 'user-agent': 'tgbtc-switch-height/1.0' } });
    if (!response.ok) return 0;
    return Number.parseInt(text, 10) || 0;
  } catch { return 0; }
}

function findActions(eventsBody) {
  const events = (eventsBody && (eventsBody.events || eventsBody)) || [];
  if (!Array.isArray(events)) return [];
  const rows = [];
  for (const event of events) {
    const actions = Array.isArray(event.actions) ? event.actions : [];
    for (const action of actions) {
      const type = action.type || action.action_type || 'ACTION';
      const simple = action.simple_preview || {};
      const value = action.JettonMint || action.JettonBurn || action.JettonTransfer || action[action.type] || {};
      rows.push({
        type,
        timestamp: event.timestamp || event.utime || event.event_id,
        event_id: event.event_id || event.trace_id || '',
        status: action.status || (action.success === false ? 'FAILED' : 'CONFIRMED'),
        amount: simple.value || value.amount || value.jetton_amount || value.amount_str || '',
        account: simple.accounts?.[0]?.address || value.sender?.address || value.recipient?.address || value.owner?.address || '',
        ton_tx: event.event_id || event.trace_id || '',
        raw: action
      });
    }
  }
  return rows;
}

function txRows(txBody) {
  const txs = (txBody && (txBody.transactions || txBody)) || [];
  if (!Array.isArray(txs)) return [];
  return txs.map((tx) => ({
    timestamp: tx.utime || tx.now || tx.created_at,
    status: tx.success === false ? 'FAILED' : 'CONFIRMED',
    ton_tx: tx.hash || tx.transaction_id?.hash || '',
    account: tx.account?.address || '',
    raw: tx
  }));
}

async function fallbackData(cfg, source, limit) {
  const [jetton, holders, minterAccount, teleportAccount, minterEvents, teleportEvents, minterTx, teleportTx, bitcoinHeight] = await Promise.all([
    getTonApi(cfg, `/jettons/${encodeURIComponent(cfg.minter)}`),
    getTonApi(cfg, `/jettons/${encodeURIComponent(cfg.minter)}/holders`, { limit, offset: 0 }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.minter)}`),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.teleport)}`),
    getTonApi(cfg, `/accounts/${encodeURIComponent(cfg.minter)}/events`, { limit }),
    getTonApi(cfg, `/accounts/${encodeURIComponent(cfg.teleport)}/events`, { limit }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.minter)}/transactions`, { limit }),
    getTonApi(cfg, `/blockchain/accounts/${encodeURIComponent(cfg.teleport)}/transactions`, { limit }),
    getBitcoinHeight(cfg)
  ]);

  const jettonBody = jetton.ok ? jetton.body : {};
  const holdersBody = holders.ok ? holders.body : {};
  const minterActions = findActions(minterEvents.ok ? minterEvents.body : null);
  const teleportActions = findActions(teleportEvents.ok ? teleportEvents.body : null);
  const allActions = [...minterActions, ...teleportActions].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  const mints = allActions.filter((r) => /mint/i.test(r.type)).map((r) => ({ created_at: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : undefined, amount: r.amount || 'mint', status: r.status, ton_tx: r.ton_tx, receiver_addr: r.account, raw: r.raw }));
  const burns = allActions.filter((r) => /burn|pegout|withdraw/i.test(r.type)).map((r) => ({ created_at: r.timestamp ? new Date(Number(r.timestamp) * 1000).toISOString() : undefined, amount: r.amount || 'burn', pegout_status: r.status, ton_tx: r.ton_tx, sender_addr: r.account, raw: r.raw }));

  const totalSupplyRaw = jettonBody.total_supply || jettonBody.totalSupply || jettonBody.metadata?.total_supply || 0;
  const decimals = Number(jettonBody.metadata?.decimals || jettonBody.decimals || 8);
  const supplyNum = Number(totalSupplyRaw || 0) / (10 ** decimals);

  const info = {
    Fallback: true,
    FallbackReason: 'Official metrics endpoint was unavailable or did not return this source; this view is synthesized from TonAPI + public Bitcoin height.',
    Environment: cfg.environment,
    MaintenanceMode: cfg.maintenance,
    ContractTeleport: {
      Enabled: cfg.maintenance !== '1',
      MinterAddress: cfg.minterRaw || cfg.minter,
      TeleportAddress: cfg.teleportRaw || cfg.teleport,
      CoordinatorAddress: cfg.coordinator,
      BitcoinClientAddress: cfg.bitclient,
      Limits: { MinPeginAmount: 0, MinPegoutAmount: 0 },
      UTXOset: [],
      PeginsCount: 0,
      TotalServiceFee: 0,
      BaseSVB: 0,
      NextSVB: 0,
      CsvLock: 0,
      TweakedPubkey: '',
      InternalKey: ''
    },
    BitcoinNetworkInfo: { Chain: cfg.btcNetwork, Blocks: bitcoinHeight, BestBlockHash: '' },
    ContractBitcoinClient: { LastConfirmedBlockHeight: 0, LastConfirmedBlockHash: '', ConfirmationsNeeded: cfg.id === 'mainnet' ? 6 : 2 },
    Jetton: jettonBody,
    Holders: holdersBody,
    Accounts: { minter: minterAccount, teleport: teleportAccount }
  };

  const plots = {
    fallback: true,
    total_minted: Number.isFinite(supplyNum) ? supplyNum : 0,
    total_burned: 0,
    mints_count: mints.length,
    burns_count: burns.length,
    holders_count: holdersBody.total || holdersBody.holders?.length || holdersBody.addresses?.length || 0,
    total_supply: Number.isFinite(supplyNum) ? supplyNum : 0
  };

  const dkg = { fallback: true, StandaloneMode: false, DkgInfo: { State: 'UNKNOWN', VSetSize: 0, ValidatorsCountMax: 0, ValidatorsCountInDkg: 0, ValidatorsCountNotInDkg: 0, ValidatorsCountEvicted: 0 } };
  const alerts = cfg.maintenance === '1' ? [{ level: 'warn', message: 'Mainnet official config has MAINTENANCE_MODE=1. Explorer is read-only; bridge sending should stay disabled.' }] : [];
  const system = { network: cfg, tonapi: { jetton, holders, minterAccount, teleportAccount, minterEvents, teleportEvents, minterTx, teleportTx } };

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
