# por-attest

A Telegraph miner that answers "Is this asset fully backed right now?" Start with
[docs/tutorial.md](docs/tutorial.md). The brief and task list are in [CLAUDE.md](CLAUDE.md) and
[PLAN.md](PLAN.md).

```bash
npm install
npm test
```

## Deploy

1. `npx wrangler login`
2. Put your KV namespace id in `wrangler.toml`.
3. `npx wrangler secret put SOLANA_RPC_URL`
4. `npm run deploy`

Layout: `src/` is the Worker, `src/data/` the asset and report data, `fixtures/` the mission cases,
`buyer/` our labelled buyer app, `e2e/` tests against a running Worker.

## Register (testnet)

`.env` is gitignored and holds separate throwaway miner and buyer wallets. Fund the miner address
with Sepolia ETH, deploy, then run `scripts/register.sh`.
