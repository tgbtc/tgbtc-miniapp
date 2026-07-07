# tgBTC Explorer v10 Full Switch

Один сайт для `https://tgbtc-miniapp.vercel.app/` с переключателем:

- Sandbox / Testnet — `https://sandbox.teleport.tg/metrics/api`, signet BTC, TON testnet.
- Mainnet / Prod — `https://teleport.tg/metrics/api`, Bitcoin mainnet, TON mainnet.

## Главные файлы

Загружать в GitHub/Vercel прямо в корень проекта:

```text
index.html
package.json
vercel.json
tonconnect-manifest.json
api/
```

## Mainnet config

```js
TON_CENTER_ENDPOINT: "https://toncenter.com"
INDEXER_GRAPHQL_ENDPOINT: "https://teleport.tg/indexer/graphql"
TON_CONTRACT_MINTER_ADDR: "EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU"
TON_CONTRACT_TELEPORT_ADDR: "EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-"
TON_CONTRACT_COORDINATOR: "Ef_q19o4m94xfF-yhYB85Qe6rTHDX-VTSzxBh4XpAfZMaOvk"
TON_CONTRACT_BITCLIENT_ADDR: "EQC8zTEAt9BjhteymRnOq8hK7AuUnseB1xPNHjreCZswNFj2"
BITCOIN_RPC_ENDPOINT: "https://bitcoin-rpc.publicnode.com"
MAINTENANCE_MODE: "1"
```

Mainnet в этом билде показывает данные и риски. Реальная отправка BTC на mainnet не включена, пока официально стоит `MAINTENANCE_MODE=1`.

## URL

```text
/?mode=testnet
/?mode=mainnet
```
