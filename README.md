# tgBTC Explorer v9 — Mainnet + Testnet Switch

One deployed URL with two modes:

- **Sandbox / Testnet Bridge** — signet BTC + TON testnet bridge testing, pegin/pegout/refund monitor, TonConnect testnet burn.
- **Mainnet Watch** — read-only TON mainnet monitoring for real tgBTC master and Teleport contracts.

## Mainnet contracts

- tgBTC master: `EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU`
- Teleport: `EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-`

Mainnet mode is intentionally read-only. It shows supply, holders, account balances, master/teleport events and raw JSON. It does not create real BTC deposit addresses or send mainnet burns.

## Deploy to Vercel

Upload/replace everything in the project root:

```text
index.html
package.json
vercel.json
tonconnect-manifest.json
api/
```

Open:

```text
https://tgbtc-miniapp.vercel.app/?mode=testnet
https://tgbtc-miniapp.vercel.app/?mode=mainnet
```

## Optional env

Set `TONAPI_KEY` in Vercel Environment Variables for more reliable mainnet requests.
