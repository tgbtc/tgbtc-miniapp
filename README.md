# tgBTC miniapp v5 TonConnect visible

This build shows a visible **v5 TONCONNECT** badge and a dedicated **TON wallet / TonConnect** section near the top. Deploy the contents of this folder to the root of GitHub/Vercel, not the parent folder.

# tgBTC Sandbox Explorer

Testnet-only miniapp for TON Teleport BTC sandbox.

## What this build includes

- signet BTC -> tgBTC pegin address generation.
- Teleport internal-key cycle check: VALID CYCLE / EXPIRED CYCLE.
- signet BTC address watcher and txid auto-fill.
- createPegin registration through sandbox indexer.
- Active BTC -> tgBTC progress panel stored in localStorage.
- tgBTC -> signet BTC preparation: validates tb1q/tb1p address, builds scriptPubKey and burn payload.
- Active tgBTC -> BTC progress/refund monitor stored in localStorage.
- TonConnect withdraw signing: builds a standard tgBTC Jetton burn transaction and asks the connected TON testnet wallet to sign it.
- Dynamic TonConnect manifest at `/api/tonconnect-manifest`.
- Stuck pegin diagnosis: compares public signet confirmations with Teleport Bitcoin Client height and CSV refund maturity.
- Burn/pegout/refund visual monitor from sandbox metrics.

## Important

Only Bitcoin signet and TON testnet are supported. Never send mainnet BTC or real funds to generated addresses.

To deploy on Vercel, replace the repo files with this folder and commit.


## TonConnect withdraw

Use a TON testnet wallet. Prepare withdraw, connect wallet, then press Send withdraw. The app resolves the user tgBTC jetton wallet from the tgBTC master contract. If TonCenter auto-resolve fails, paste the tgBTC jetton wallet address into the optional fallback field.
