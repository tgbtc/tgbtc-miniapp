# tgBTC Miniapp v16 — Mainnet first + strict prod metrics probing

This build fixes the Vercel Hobby plan error:

`No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.`

It deploys only one function:

- `api/metrics.js`

Mainnet opens by default. It first tries the prod full metrics endpoint in the same style as testnet. If the response is actually sandbox/signet, it is rejected and the UI falls back to real TON mainnet on-chain data. Testnet opens only after switching in the UI or with `?mode=testnet`.

## Upload to GitHub root

Upload/replace these in the repository root:

- `.vercelignore`
- `api/metrics.js`
- `public/index.html`
- `public/tonconnect-manifest.json`
- `index.html`
- `tonconnect-manifest.json`
- `package.json`
- `package-lock.json`
- `vercel.json`
- `README.md`

Important: old API files can remain in GitHub, but `.vercelignore` excludes them from Vercel deployment. Best practice is still to delete old unused files from `api/` and leave only `metrics.js`.
