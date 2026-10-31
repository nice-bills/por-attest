# por-attest — project brief for Claude Code

## What this is
por-attest is a Telegraph miner (provider) entered in the Miners / Providers track of
Telegraph Hackathon Season II (H2). It answers "Is <asset> fully backed right now?" by
comparing the asset's latest reserve figure with its circulating supply, and returns the
ratio, the report's age, the source of every figure, and a verdict.

- Stack: TypeScript, Hono, viem, Cloudflare Workers, Cloudflare KV.
- Live: https://por-attest.alnicewilliams3.workers.dev
- Existing endpoints: GET /health, GET /assets, GET /reserve?question=..., /miner.yaml, /terms, /privacy, / (demo page).
- Data: 74 Chainlink Proof of Reserve feeds (source_type: chainlink_por) and issuer
  attestations for USDC, USDT, XAUT, PAXG, PYUSD, USDe (source_type: issuer_attestation).
- Tests: 69 unit + 5 end-to-end, all passing. Keep them passing.

## Hard facts about the network (checked 31 Oct 2026; re-check before relying on them)
- Telegraph moved to v2, run through Anjoman: https://anjoman.ai (docs: https://anjoman.ai/docs).
- Registration is on **Ethereum Sepolia**, not Base Sepolia.
- Registration needs a refundable **MACHINA bond**: $1 for the first intent, $0.10 for each further one.
  Test MACHINA, test USDC and the faucet are in the Anjoman dashboard.
- Intent names must match exactly (case-sensitive). The names we use:
  - `ASSET_RESERVE_ATTESTATION_GENERAL` (main intent)
  - `TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL` (second intent, reuses our supply code)
  - Do NOT use `CROSS_CHAIN_STATE_VERIFY_GENERAL`: it is about bridge proofs and state roots, not supply.
- Validate the YAML first: `POST https://integrate.telegraphprotocol.com/api/validate`
  with `{"yaml": "<raw YAML>", "miner_address": "0x..."}`. The site integrate.telegraphprotocol.com
  can also pin the YAML to IPFS and send the registration.
- The YAML can be changed after registering with `updateMiner` (it creates a new registrationId).
- YAML schema is closed: unknown keys fail validation. Every endpoint needs `description`,
  routed endpoints need `intents`, and every intent must be in `semantics.supported_intents`.
- The first 7 days after activation are a grace period that sets our starting leaderboard rank.
  Be fast and correct from day one.
- Contract addresses: always take them from the "Addresses & Parameters" page in the Anjoman docs.

## Hackathon rules that affect the code
- Final deadline: **1 Dec 2026, 23:59 UTC**. Aim to submit by 29 Nov.
- Every entry needs 70/100 to win. Quality is the biggest score (35, minimum 24), then reliability (20).
- Reviewers must be able to rerun our tests on new inputs, including failure cases.
- Our own buyer app counts as use only if it is clearly labelled as ours. Never present our own
  calls as independent adoption. "Manufactured adoption" and "collusive requests" disqualify.
- Disclose code that existed before 1 Nov (tag the repo `pre-hackathon` on 31 Oct).
- Label everything testnet as testnet.

## How answers should look
- Lead with the authoritative figures:
  - Chainlink PoR assets: the latest round's raw value, decimals, roundId and updatedAt.
  - Issuer assets: the report's own reserves, supply and ratio, with the report date.
- Put our live on-chain comparison in a separate field. It must never change the headline number.
- Every supply figure carries chain, block number and timestamp.
- Use numbers, not formatted strings, and explicit units (USD, BTC, troy oz).
- `summary` is one self-contained sentence: verdict, ratio, as-of date, source.
- Verdicts: `fully_backed`, `under_backed`, `unverified` (stale or not comparable). "unverified"
  is a normal answer with a reason, not an error.

## Rules for working in this repo
- Never commit secrets. RPC keys and any signing key live as Worker secrets (`wrangler secret put`).
- Never return a 5xx from an intent endpoint. Degrade to `unverified` with a reason.
- Keep request handling light: serve from cache/KV, do heavy reads in the scheduled (cron) handler.
- Run `npm test` before saying a task is done.
- Work through PLAN.md in order and tick items off.
