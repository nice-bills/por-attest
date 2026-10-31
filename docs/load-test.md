# Load test

## Deployed run, 31 Oct 2026

Target met: median under 500 ms, p95 under 2 s, no 5xx.

- Command: `npx autocannon -c 20 -d 30 'https://por-attest.alnicewilliams3.workers.dev/reserve?asset=USDC'`

| Metric | Result |
| --- | --- |
| Requests | 2,571 |
| 2xx | 2,571 |
| Non-2xx / errors | 0 / 0 |
| p50 | 218 ms |
| p90 | 299 ms |
| p97.5 | 441 ms |
| p99 | 671 ms |
| max | 1,121 ms |

autocannon reports p97.5 rather than p95, so p95 is under 441 ms. Measured from one home connection.

## Local run, 31 Oct 2026

- Setup: `wrangler dev --local --test-scheduled`, snapshot filled by one real cron run against
  public mainnet RPCs (all 80 assets answered; refresh under 12 s).
- Command: `npx autocannon -c 20 -d 20 'http://localhost:8799/reserve?asset=USDC'`

| Metric | Result |
| --- | --- |
| Requests | 10,650 |
| 2xx | 10,650 |
| Non-2xx / errors | 0 / 0 |
| p50 | 34 ms |
| p90 | 46 ms |
| p97.5 | 61 ms |
| p99 | 73 ms |
| max | 225 ms |

autocannon reports p97.5 and p99 rather than p95, so p95 lies between 46 and 61 ms. Local KV has
no network cost, so expect slower figures once deployed.
