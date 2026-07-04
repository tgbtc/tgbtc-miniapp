# tgBTC Sandbox Explorer v7 TonConnect Safe

This build adds visible TonConnect and extra safety checks for tgBTC -> signet BTC withdraw.

Important:
- Use only Bitcoin signet and TON testnet.
- For withdraw, the `tgBTC JETTON WALLET ONLY` field must contain the user-specific tgBTC jetton wallet address.
- Do not paste owner wallet address.
- Do not paste tgBTC master contract address.
- v7 blocks the known tgBTC master and known owner wallet inputs to avoid failed burns.

If a pegin is stuck in PENDING while mempool.space shows confirmations, check BTC client lag. The frontend cannot force SUCCESS until Teleport Bitcoin Client catches the tx block and the relayer mints tgBTC.
