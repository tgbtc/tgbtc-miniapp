# tgBTC Miniapp v12 — Mainnet real first + Testnet switch

Открытие без параметров сразу показывает MAINNET / PROD.

Mainnet в этой версии НЕ берёт `https://teleport.tg/metrics/api`, потому что этот endpoint может отдавать sandbox/signet данные. Чтобы не показывать ложный mainnet, v12 принудительно показывает mainnet через реальные TON mainnet контракты: tgBTC master, Teleport, Bitcoin Client account, holders/events через TonAPI.

Testnet/Sandbox остаётся как раньше и использует full metrics: `https://sandbox.teleport.tg/metrics/api`.

## URL

- Mainnet default: `https://tgbtc-miniapp.vercel.app/`
- Mainnet explicit: `https://tgbtc-miniapp.vercel.app/?mode=mainnet`
- Testnet: `https://tgbtc-miniapp.vercel.app/?mode=testnet`

## Upload to GitHub/Vercel

Upload all files to project root:

```text
index.html
package.json
vercel.json
tonconnect-manifest.json
README.md
api/
```

## Mainnet config

```text
tgBTC master: EQBmjxpYsJ8yHEraYfTpLdejCekHMoKS2fOErP4lLHCf4SlU
Teleport: EQC6o-Ri4Q3R3H1xOTaPawZ964iqha3TzJGAmpi8h4XqcP3-
Coordinator: Ef_q19o4m94xfF-yhYB85Qe6rTHDX-VTSzxBh4XpAfZMaOvk
Bitcoin Client: EQC8zTEAt9BjhteymRnOq8hK7AuUnseB1xPNHjreCZswNFj2
Maintenance: 1, read-only
```
