# Evidence pack

Everything here is testnet unless it says otherwise. Payment is on Ethereum Sepolia. Data reads are
from mainnet chains. The buyer app is ours, and its calls are not independent adoption.

| Evidence | Status | Where |
| --- | --- | --- |
| Pre-hackathon disclosure | Ready; tag not yet pushed | [pre-hackathon.md](pre-hackathon.md), tag `pre-hackathon` |
| Fixture report | Ready for local run only: 27 of 27 passed against `wrangler dev` on 31 Oct 2026 | [fixtures/report.md](../fixtures/report.md) |
| Unit tests | Ready: run `npm test` | `test/` |
| End-to-end tests | Passed against `wrangler dev`; deployed run pending | `e2e/`, run with `E2E_BASE_URL=<url> npm run test:e2e` |
| Load test | Local run only; deployed run pending | [load-test.md](load-test.md) |
| Unpaid 402 challenge | Ready: proves the request reaches the node. It is not a receipt | `evidence/dry-run-*.json` |
| registrationId | Pending registration | Add here |
| Validation result | Pending: `POST /api/validate` returned 404 on 31 Oct 2026 | Add here |
| Paid request and receipts | Pending funded wallet and registration; needs at least two UTC dates | `evidence/receipt-*.json` |
| por-attest paid as miner | Pending; check `por_attest_was_paid` in each receipt | `evidence/receipt-*.json` |
| Uptime history | Pending monitor | Add public link here |
| Ranking reference | Pending activation and the 7-day grace period | Add link here |

## To complete after deploying

```bash
E2E_BASE_URL=https://por-attest.alnicewilliams3.workers.dev npm run test:e2e
```

```bash
npm run fixtures -- --target https://por-attest.alnicewilliams3.workers.dev
```

```bash
npm run load -- 'https://por-attest.alnicewilliams3.workers.dev/reserve?asset=USDC'
```

```bash
BUYER_PRIVATE_KEY=0x... npm run buyer -- USDC WBTC PAXG
```

Run the buyer again on a later UTC date with different assets.
