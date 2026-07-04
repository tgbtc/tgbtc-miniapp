# tgBTC Sandbox Explorer v8

One-click oriented sandbox miniapp for Bitcoin signet ↔ tgBTC on TON testnet.

## v8 changes

- Visible badge: `v8 ONE-CLICK TG-BTC`.
- TonConnect testnet wallet block.
- Auto-resolves the connected wallet's tgBTC jetton wallet with `/api/resolve-jetton-wallet`.
- Shows tgBTC balance before withdraw.
- Blocks unsafe burn targets: owner wallet and tgBTC master.
- Quick buttons: minimum test amount, safe available amount, clear saved withdraw.
- Keeps BTC→tgBTC pegin monitor, stuck pegin diagnosis, burn/pegout monitor, BTC reserve and protocol health.

## Safety

Only Bitcoin signet and TON testnet. Do not send mainnet BTC to generated addresses.
