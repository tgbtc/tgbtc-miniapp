# tgBTC Miniapp v15 — Mainnet first, Hobby plan safe

This build fixes the Vercel Hobby plan error:

`No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.`

It deploys only one function:

- `api/metrics.js`

Mainnet opens by default. Testnet opens only after switching in the UI or with `?mode=testnet`.

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
