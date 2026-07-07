# tgBTC Explorer v11 — Mainnet first

Один сайт для `https://tgbtc-miniapp.vercel.app/`.

По умолчанию открывается **Mainnet / Prod**. Testnet/Sandbox можно включить кнопкой или URL:

- `/` — mainnet по умолчанию
- `/?mode=mainnet` — mainnet
- `/?mode=testnet` — sandbox/testnet

## Что исправлено

- Mainnet теперь открыт по умолчанию.
- Mainnet не показывает выдуманные `0` для BTC client / DKG / reserve, если full metrics API недоступен.
- Если prod metrics API отвечает — показывается full view как в testnet.
- Если prod metrics API не отдаёт источник — показывается chain-only mainnet: supply, holders, master/teleport activity, events, accounts, raw JSON.
- Отправка real BTC в mainnet отключена, пока в официальном prod config `MAINTENANCE_MODE=1`.

## Mainnet config

- tgBTC master: `EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU`
- Teleport: `EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-`
- Coordinator: `Ef_q19o4m94xfF-yhYB85Qe6rTHDX-VTSzxBh4XpAfZMaOvk`
- Bitcoin Client: `EQC8zTEAt9BjhteymRnOq8hK7AuUnseB1xPNHjreCZswNFj2`
- Indexer: `https://teleport.tg/indexer/graphql`
- Metrics: `https://teleport.tg/metrics/api`

## Deploy

Загрузи в корень GitHub/Vercel:

- `index.html`
- `package.json`
- `vercel.json`
- `tonconnect-manifest.json`
- `README.md`
- `api/`
