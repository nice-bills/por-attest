# por-attest tutorial

por-attest answers one question: "Is this asset fully backed right now?" You give it an asset, and
it returns a verdict, the authoritative figures, where each came from, and how old they are.

**Networks.** Payment for Telegraph calls settles on Ethereum Sepolia, which is a **testnet**, in
test USDC. The data is **mainnet** data: Chainlink feeds and token supply on Ethereum, Base, Arbitrum,
Optimism, Polygon, BNB Chain, Avalanche, Ink, Plasma, Mantle, Tron and Solana.

## Prerequisites

- Node.js 20 or newer. To call the HTTP API directly you need only `curl`.
- To call through Telegraph: a wallet on Ethereum Sepolia holding test USDC.

```bash
git clone https://github.com/nice-bills/por-attest.git
cd por-attest
npm install
npm test
```

## Call it directly

Direct calls need no key and no payment.

```bash
curl 'https://por-attest.alnicewilliams3.workers.dev/reserve?asset=PAXG'
```

You can pass a question instead of a symbol:

```bash
curl -G 'https://por-attest.alnicewilliams3.workers.dev/reserve' --data-urlencode 'question=Is USDC fully backed right now?'
```

Supply on its own:

```bash
curl 'https://por-attest.alnicewilliams3.workers.dev/supply?asset=USDC'
```

Verify a single on-chain payment:

```bash
curl 'https://por-attest.alnicewilliams3.workers.dev/transfer?chain=base&tx_hash=0xf8feab7e31110a1a702f5d43052a9f4b3bd4e7c3d68b377f4c9c0443032caf0d'
```

`verdict` is `verified`, `failed` (the transaction reverted) or `unverified` (not found, or under 12 confirmations). The response gives `status`, `from`, `to`, `token`, `amount`, `block_number`, `confirmations` and a `transfers` list. Sepolia is supported and labelled `network: "testnet"`.

`GET /assets` lists all 74 Chainlink feeds and 6 issuer-attested assets.

## Call it through Telegraph

Our miner is registered as id 27741 (registrationId 4865). Telegraph picks a miner by leaderboard rank, so a routed
call may not reach por-attest. New miners get little routing during the 7-day grace period. The second form below names our miner directly.

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H 'content-type: application/json' \
  -d '{"intent":"ASSET_RESERVE_ATTESTATION_GENERAL","params":{"asset":"USDC"}}'
```

That first call returns `402 Payment Required`. The challenge names the price and where to pay, and
an x402 client signs the payment and retries. `buyer/solvency-check.ts` does all of this:

```bash
BUYER_PRIVATE_KEY=0x... npm run buyer -- USDC
```

Use a throwaway testnet wallet, and never commit its key. Add `--dry-run` to see the challenge
without a key or a payment.

To name our miner, post to `/engine/v1/ask/27741` with
`{"method":"GET","endpoint":"/reserve","payload":{"asset":"USDC"}}`.

## Example request and response

Request: `GET /reserve?asset=PAXG`

```json
{
  "intent": "ASSET_RESERVE_ATTESTATION_GENERAL",
  "source_type": "issuer_attestation",
  "asset": "PAXG",
  "question": null,
  "verdict": "fully_backed",
  "verdict_type": "reserve_backing",
  "fully_backed": true,
  "confidence": 0.8,
  "summary": "PAXG is fully backed: ratio 1.0000 as of 2026-09-30, from the KPMG LLP (monthly examination, AICPA criteria) report for Paxos.",
  "reason": "Reserves and supply are both from the report dated 2026-09-30 (https://framerusercontent.com/assets/uwWybrLRlgkC4vexP3yLyrQVeV0.pdf). live_comparison is our own on-chain read and does not change the headline.",
  "stale": false,
  "headline": {
    "reserves": 435306,
    "supply": 435306,
    "ratio": 1,
    "unit": "troy oz",
    "as_of": "2026-09-30",
    "block": "2026-09-30",
    "source": "KPMG LLP (monthly examination, AICPA criteria) report for Paxos"
  },
  "report": {
    "kind": "independent_attestation",
    "attestor": "KPMG LLP (monthly examination, AICPA criteria)",
    "report_date": "2026-09-30",
    "cadence": "monthly",
    "stale_after_days": 76,
    "report_url": "https://framerusercontent.com/assets/uwWybrLRlgkC4vexP3yLyrQVeV0.pdf",
    "page_url": "https://www.paxos.com/paxg-transparency",
    "reserves": 435306,
    "supply_reported": 435306,
    "age_days": 31
  },
  "live_comparison": {
    "supply": 442886.411077,
    "ratio": 0.9828840739128433,
    "complete": true,
    "chains": [
      {
        "chain": "ethereum",
        "token": "0x45804880De22913dAFE09f4980848ECE6EcbAf78",
        "decimals": 18,
        "total_supply": 442886.411077,
        "treasury_balance": 0,
        "circulating": 442886.411077,
        "block_number": 26314790,
        "block_timestamp": "2026-10-31T19:19:11.000Z"
      }
    ],
    "unread": []
  },
  "as_of": "2026-10-31T19:19:24.996Z",
  "snapshot_at": "2026-10-31T19:19:15.463Z"
}
```

### Every field

| Field | Meaning |
| --- | --- |
| `intent` | The Telegraph intent this answers. |
| `source_type` | `chainlink_por` or `issuer_attestation`. |
| `asset` | The asset answered for. |
| `question` | Your question, echoed back, or `null`. |
| `verdict` | `fully_backed`, `under_backed` or `unverified`. `unverified` is a normal answer, not an error. |
| `verdict_type` | `reserve_backing`, or `collateral_coverage` for USDe, a hedged synthetic dollar and not a reserve-backed stablecoin. |
| `fully_backed` | The verdict as true or false; `null` when unverified. |
| `confidence` | 0 to 1: 0.97 Chainlink, 0.8 independent attestation, 0.6 issuer disclosure, 0 unverified. These are our fixed labels, not a calculated probability. |
| `summary` | One sentence: verdict, ratio, date, source. |
| `reason` | How the figures were obtained, and why an answer is unverified. |
| `stale` | True when the feed missed its heartbeat or the report is past its limit. |
| `headline` | The authoritative figures. Our own reads never change this block. |
| `headline.reserves` / `supply` / `ratio` | From the same report. On Chainlink assets `supply` and `ratio` are `null`, because a feed reports reserves only. |
| `headline.unit` | The unit of the figures, e.g. USD, BTC, troy oz. |
| `headline.as_of` | The report date or the round's update time. |
| `headline.block` | The Chainlink round id, or the report date. |
| `headline.source` | Who published the figure. |
| `report` | Issuer assets only: the report's attestor, date, cadence, links and age. |
| `chainlink` | Feed assets only: `answer_raw`, `decimals`, `round_id`, `updated_at`, `age_seconds`, `heartbeat_seconds`, `feed`, `chain`. Raw values are strings because they are too large for a JSON number to hold exactly. |
| `live_comparison` | Our own on-chain supply read and the ratio against it. On issuer assets it is context. In the PAXG example supply has grown since the report, so this ratio is below 1 while the verdict stands. |
| `live_comparison.complete` | False if a chain could not be read. `unread` says which, and why. |
| `live_comparison.chains` | Per-chain supply, each with its block number and timestamp. On Solana, `block_number` is the slot and the timestamp is the read time. |
| `as_of` | When this response was built. |
| `snapshot_at` | When the on-chain data was read. Reads refresh about every 2 minutes. |

On Chainlink assets the verdict comes from `live_comparison.ratio`, since a feed has no supply
figure of its own. Reserves within 0.1% of supply count as covered, because the two reads are taken
at different times.

### Audit parameters

- `round_id`: the exact figure of a past Chainlink round. It is judged against today, so it reads as stale.
- `report_date`: the exact figures of a held report, judged as of that report's date.

## Run the fixtures

Each mission has normal cases and failure cases.

```bash
npm run fixtures -- --mission exchange --target https://por-attest.alnicewilliams3.workers.dev
```

- Missions: `stablecoin`, `exchange`, `asset-management`, `mining-and-power`, `consumer-automation`, `model-economy`, `web3-defi`. Leave `--mission` out to run all three.
- The command prints pass or fail per case and writes `fixtures/report.md`.
- `--target telegraph` sends the same cases through Telegraph and pays for each one, so it needs
  `BUYER_PRIVATE_KEY` and a registered miner.
- Try any asset with `npm run try -- USDe`.

There are three fixture modes:

- `pinned`: exact numbers from a past round, report or transaction. These never drift.
- `live`: rules that always hold, such as "ratio equals reserves / supply".
- `simulated`: stale reports and RPC disagreement can't be forced on a live server, so these feed
  the case straight into the real answer code. They don't touch `--target`.

## Cost per call and floor price

- Calling the miner directly is free.
- A routed Telegraph call cost $0.01 in test USDC in the challenge we observed. The real price is the
  amount in each 402 challenge: the miner's floor times a demand multiplier.
- `scripts/register.sh` sets our floor to $0.01, the protocol minimum.
- Our running cost is one Cloudflare Worker, one KV namespace and any Solana RPC plan.

## Limitations

- Issuer reports come from the `attestations` KV key, written by a separate job, on top of the
  seed data in `src/data/attestations.json`. A report past its limit makes the answer `unverified`.
- Stored report figures were captured from the earlier deployed Worker and have not been checked
  again against the source PDFs.
- `live_comparison` may be partial. USDC and USDT live on many more chains than we read, so a
  `complete: true` answer means every chain *we list* was read, not every chain that exists.
- Treasury wallets are configured only for USDT on Ethereum and Tron.
- The asset list is fixed. Anything else gets `404 NO_POR_FEED`.
- 44 of the 80 assets currently answer `unverified`, mostly because their feed can't be compared
  with an on-chain supply. Reserves are still shown.
- If two RPCs disagree by more than 0.5%, that chain's figures are withheld.
- `/transfer` reads on request, so it is slower than `/reserve`. If RPCs are unavailable it returns `unread`; retry it. Settled results are cached, so repeat lookups are served from KV. It covers EVM chains only. A contract call moving several tokens lists them all, with the first as the headline.
- The Web3 DeFi fixtures check the escrow's settlement payment only, not the event that triggers it.
- Solana supply needs a keyed RPC. Public endpoints refuse Cloudflare's IPs.

## Credential handling

The miner holds no user credentials and asks callers for none. The optional secrets are
`SOLANA_RPC_URL` and `ALCHEMY_API_KEY`, kept as Worker secrets and never returned in an answer. Set one with:

```bash
npx wrangler secret put SOLANA_RPC_URL
```

The buyer app reads `BUYER_PRIVATE_KEY` from the environment and never writes it to disk. Your
receipts in `evidence/` contain your wallet address, which is public.
