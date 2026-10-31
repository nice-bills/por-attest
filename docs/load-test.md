# Load test

**Status: the PLAN task 6 target is not yet proven on the deployed Worker.** The Worker at
por-attest.alnicewilliams3.workers.dev still runs the older code, and this rewrite could not be
deployed from here. The numbers below are from a local run and show only the handler's own cost.

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

## To finish the task

After deploying, run this and paste the output here (target: median under 500 ms, p95 under 2 s):

```bash
npm run load -- 'https://por-attest.alnicewilliams3.workers.dev/reserve?asset=USDC'
```
