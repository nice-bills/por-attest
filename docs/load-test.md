# Load test

## Deployed run, 1 Nov 2026

Target met: median under 500 ms, p95 under 2 s, no 5xx.

- Command: `npx autocannon -c 20 -d 30 'https://por-attest.alnicewilliams3.workers.dev/reserve?asset=USDC'`

| Metric | Result |
| --- | --- |
| Requests | 7,932 |
| 2xx | 7,932 |
| Non-2xx / errors | 0 / 0 |
| p50 | 56 ms |
| p90 | 80 ms |
| p97.5 | 113 ms |
| p99 | 135 ms |
| max | 6,660 ms |

autocannon reports p97.5 rather than p95, so p95 is under 113 ms. Measured from one home connection.
The maximum shows a rare slow request; the percentiles are the typical case.
