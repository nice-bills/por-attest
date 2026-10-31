# Fixture report

Target: https://por-attest.alnicewilliams3.workers.dev
Run: 2026-10-31T21:14:54.029Z

| Mission | Case | Mode | Result | Detail |
| --- | --- | --- | --- | --- |
| asset-management | paxg-live | live | pass |  |
| asset-management | paxg-report | pinned | pass |  |
| asset-management | rpcs-disagree | simulated | pass |  |
| asset-management | stale-report | simulated | pass |  |
| asset-management | stale-round | pinned | FAIL | headline.reserves: got null, wanted 9687011.318590214; chainlink.round_id: got undefined, wanted "18446744073709554689" |
| asset-management | unclear-question | live | pass |  |
| asset-management | unknown-asset | live | pass |  |
| asset-management | usdt-supply | live | pass |  |
| asset-management | xaut-question | live | pass |  |
| exchange | cbbtc-live | live | pass |  |
| exchange | rpcs-disagree | simulated | pass |  |
| exchange | stale-report | simulated | pass |  |
| exchange | stale-round | pinned | FAIL | headline.reserves: got null, wanted 9687011.318590214; chainlink.round_id: got undefined, wanted "18446744073709554689" |
| exchange | unclear-question | live | pass |  |
| exchange | unknown-asset | live | pass |  |
| exchange | usdc-supply | live | pass |  |
| exchange | wbtc-live | live | FAIL | provenance: headline has no source or date |
| exchange | wbtc-round | pinned | FAIL | headline.reserves: got null, wanted 116144.64916289; chainlink.answer_raw: got undefined, wanted "11614464916289"; chainlink.decimals: got undefined, wanted 8; chainlink.round_id: got undefined, wanted "36893488147419104257"; chainlink.updated_at: got undefined, wanted "2026-10-21T04:33:11.000Z" |
| stablecoin | pyusd-question | live | pass |  |
| stablecoin | rpcs-disagree | simulated | pass |  |
| stablecoin | stale-report | simulated | pass |  |
| stablecoin | stale-round | pinned | pass |  |
| stablecoin | unclear-question | live | pass |  |
| stablecoin | unknown-asset | live | pass |  |
| stablecoin | usdc-live | live | pass |  |
| stablecoin | usdc-report | pinned | pass |  |
| stablecoin | usdt-report | pinned | pass |  |

4 failed.
