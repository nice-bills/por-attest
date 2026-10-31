# Evidence pack

Everything here is testnet unless it says otherwise. Payment is on Ethereum Sepolia. Data reads are
from mainnet chains. The buyer app is ours, and its calls are not independent adoption.

| Evidence | Status | Where |
| --- | --- | --- |
| Pre-hackathon disclosure | Ready; tag not yet pushed | [pre-hackathon.md](pre-hackathon.md), tag `pre-hackathon` |
| Fixture report | Ready: 27 of 27 passed against the deployed Worker on 31 Oct 2026 | [fixtures/report.md](../fixtures/report.md) |
| Unit tests | Ready: run `npm test` | `test/` |
| End-to-end tests | Passed against the deployed Worker | `e2e/`, run with `E2E_BASE_URL=<url> npm run test:e2e` |
| Load test | Ready: p50 218 ms, no 5xx | [load-test.md](load-test.md) |
| Unpaid 402 challenge | Ready: proves the request reaches the node. It is not a receipt | `evidence/dry-run-*.json` |
| registrationId | 4858, Ethereum Sepolia tx `0x9475acd533dc9e533d779b1f8f0da6f0605be8e70d03641061ec2f4bc0f55267`; node activation pending | https://devnode.telegraphprotocol.com/api/miners/4858 |
| Validation result | Pending: `POST /api/validate` returned 404 on 31 Oct 2026 | Add here |
| Paid request and receipts | Pending funded wallet and registration; needs at least two UTC dates | `evidence/receipt-*.json` |
| por-attest paid as miner | Pending; check `por_attest_was_paid` in each receipt | `evidence/receipt-*.json` |
| Uptime history | Pending monitor | Add public link here |
| Ranking reference | Pending activation and the 7-day grace period | Add link here |

## Still to run

Run on two UTC dates with different assets, once the node shows the miner as active:

```bash
set -a; . ./.env; set +a; npm run buyer -- USDC WBTC PAXG
```
