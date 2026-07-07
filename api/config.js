module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    defaultNetwork: 'mainnet',
    mainnet: {
      environment: 'prod',
      maintenance: '1',
      readOnly: true,
      metricsApi: 'https://teleport.tg/metrics/api',
      indexer: 'https://teleport.tg/indexer/graphql',
      tonCenter: 'https://toncenter.com',
      minter: 'EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU',
      teleport: 'EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-',
      coordinator: 'Ef_q19o4m94xfF-yhYB85Qe6rTHDX-VTSzxBh4XpAfZMaOvk',
      bitclient: 'EQC8zTEAt9BjhteymRnOq8hK7AuUnseB1xPNHjreCZswNFj2',
      bitcoinRpc: 'https://bitcoin-rpc.publicnode.com'
    },
    testnet: {
      environment: 'sand',
      maintenance: '0',
      readOnly: false,
      metricsApi: 'https://sandbox.teleport.tg/metrics/api',
      indexer: 'https://sandbox.teleport.tg/indexer/graphql',
      tonCenter: 'https://testnet.toncenter.com',
      minter: 'EQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdLub',
      teleport: 'EQDhF3lwtyKpQi2O9nS4XNyyyIKV7jl9cVCko4L5GSFAnHRo',
      coordinator: 'EQD43RtdAQ_Y8nl86SqzxjlL_-rAvdZiBDk_s7OTF-oRxmwo',
      bitclient: 'EQCuCNaMk85GtP2bjBMB6Jh0SMaH3gWU_kxE-LIBU0ydEJUt',
      bitcoinRpc: 'https://bitcoin-rpc.ton-teleport.rsquad.solutions/'
    }
  });
};
