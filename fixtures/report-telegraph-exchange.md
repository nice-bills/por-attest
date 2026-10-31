# Fixture report

Target: telegraph
Run: 2026-10-31T21:44:04.090Z

| Mission | Case | Mode | Result | Detail |
| --- | --- | --- | --- | --- |
| exchange | cbbtc-live | live | FAIL | under_5s: took 21154 ms |
| exchange | rpcs-disagree | simulated | pass |  |
| exchange | stale-report | simulated | pass |  |
| exchange | stale-round | pinned | pass |  |
| exchange | unclear-question | live | FAIL | status 500, wanted 400; error.code: got undefined, wanted "ASSET_REQUIRED" |
| exchange | unknown-asset | live | FAIL | status 500, wanted 404; error.code: got undefined, wanted "NO_POR_FEED"; verdict: got undefined, wanted "unverified" |
| exchange | usdc-supply | live | FAIL | under_5s: took 7694 ms |
| exchange | wbtc-live | live | FAIL | under_5s: took 12888 ms |
| exchange | wbtc-round | pinned | pass |  |

5 failed.
