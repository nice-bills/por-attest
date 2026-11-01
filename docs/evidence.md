# Evidence pack

Everything here is testnet unless it says otherwise. Only activity from 1 Nov 2026 onwards is claimed; earlier test activity is not. Payment is on Ethereum Sepolia. Data reads are
from mainnet chains. The buyer app is ours, and its calls are not independent adoption.

| Evidence | Status | Where |
| --- | --- | --- |
| Pre-hackathon disclosure | Ready; tag pushed | [pre-hackathon.md](pre-hackathon.md), tag `pre-hackathon` |
| Fixture report | Ready: 59 of 59 passed against the deployed Worker on 1 Nov 2026, across 7 missions | [fixtures/report.md](../fixtures/report.md) |
| Unit tests | Ready: run `npm test` | `test/` |
| End-to-end tests | Passed against the deployed Worker | `e2e/`, run with `E2E_BASE_URL=<url> npm run test:e2e` |
| Load test | Ready: p50 56 ms, no 5xx, 1 Nov 2026 | [load-test.md](load-test.md) |
| Unpaid 402 challenge | Ready: proves the request reaches the node. It is not a receipt | `evidence/dry-run-*.json` |
| registrationId | 4865, Ethereum Sepolia tx `0x1663173eac29f38b4089f59642d2b85f8cfbfce119b1e81357c57c801e91b5e4`, serving three intents | https://devnode.telegraphprotocol.com/api/miners/4865 |
| Validation result | Pending: `POST /api/validate` returned 404 on 1 Nov 2026 | Add here |
| Paid request and receipts | 10 paid calls on 1 Nov 2026 | `evidence/receipt-*2026-11-01*.json` |
| por-attest paid as miner | 7 direct calls on 1 Nov 2026 (USDT, PYUSD, XAUT twice, WBTC, USDe, stETH). The 3 routed calls went to miner 81009 | `evidence/receipt-*2026-11-01*.json` |
| Uptime history | Running from GitHub Actions since 1 Nov 2026, checks about every 10 minutes | https://github.com/nice-bills/por-attest/tree/uptime |
| Ranking reference | Pending activation and the 7-day grace period | Add link here |
