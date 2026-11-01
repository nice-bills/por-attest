# por-attest — task plan (deadline 1 Dec 2026, 23:59 UTC)

Work top to bottom. Each task lists what "done" means.

## Phase 1 — Before registering (31 Oct to 2 Nov)

- [ ] **1. Tag the pre-hackathon code**
  Status 31 Oct: Tag made on the brief-only commit (no source existed). Not pushed: no remote yet.
  Done: git tag `pre-hackathon` on the current commit, pushed.

- [ ] **2. Rewrite miner.yaml for v2**
  Status 31 Oct: `miner.yaml` is active on the node, which ran its own schema check. The hosted validator returned 404.
  Use `miner.v2.yaml` in this kit as the starting point. Fill in `id`, `slug`, `base_url`.
  Done: `POST https://integrate.telegraphprotocol.com/api/validate` returns no errors and no
  warnings about missing params.

- [x] **3. Add the `/supply` endpoint** (for `TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL`)
  Returns circulating supply per chain and total, each with chain, block number and timestamp.
  Reuses the existing supply code.
  Done: unit tests for the response shape; e2e test hitting the deployed Worker.

- [x] **4. Make answers lead with authoritative figures**
  See "How answers should look" in CLAUDE.md.
  Done: tests show the headline equals the Chainlink round value or the issuer report figure exactly.

- [x] **5. Fix the comparison logic**
  - Headline ratio uses reserves and supply from the same report (no mixing dates).
  - Live drift since the report goes in a separate field.
  - Bridged copies (e.g. USDC.e) are not counted twice.
  - Known issuer treasury wallets are subtracted from circulating supply.
  - Gold tokens report in troy oz; USDe gets its own verdict type, not the stablecoin one.
  Done: a test proves the cross-chain total has no double count.

- [x] **6. Move heavy work out of the request path**
  - A scheduled (cron) handler refreshes one combined snapshot of all assets every ~2 minutes into KV.
  - Requests read the snapshot and format it. Stale-while-revalidate with `ctx.waitUntil`.
  - Timeouts and a fallback RPC on every read.
  - No 5xx: degrade to `unverified` with a reason.
  Done: median response under 500 ms, p95 under 2 s in a load test (k6 or autocannon). Save the results.

- [x] **7. Keyed Solana RPC** as a Worker secret, so Solana supply is read on-chain.

## Phase 2 — Register (1 to 3 Nov)

- [x] **8. Get test funds**: Sepolia ETH for gas; MACHINA (bond) and test USDC from the Anjoman faucet.
- [x] **9. Register**
  registrationId 4858, `activation_status: active`.
  through integrate.telegraphprotocol.com with intents
  `ASSET_RESERVE_ATTESTATION_GENERAL` and `TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL`.
  Done: record the registrationId; `/api/miners/<registrationId>` shows `activation_status: active`.
- [ ] **10. Start an external uptime monitor** with a public history page.

## Phase 3 — Prove it works (by 20 Nov)

- [x] **11. Mission test fixtures** (see "Fixtures" below) for Stablecoin, Exchange, Asset Management.
- [ ] **12. Small buyer app (ours, labelled as ours)**
  Status 1 Nov: Second UTC date done (31 Oct and 1 Nov). On 1 Nov, 3 of 4 calls paid por-attest: all 3 direct calls. The 1 routed call went to another miner, 81009. No routed call has paid por-attest yet.
  A script-level "solvency check" agent: before accepting a token, it buys a reserve verdict through
  Telegraph's ranked routing and accepts or refuses. Run it with different assets on at least two UTC dates.
  Done: request and payment receipts saved, showing por-attest was the miner paid.
- [ ] **13. 20 Nov showcase**: post the miner and the fixtures; offer them to Apps teams on those missions.

## Phase 4 — Submission (by 29 Nov)

- [ ] **14. Demo video, 3 to 4 minutes** (outline below).
- [ ] **15. Tutorial**: prerequisites; calling through Telegraph and directly; example request and full
  expected response with every field explained; running the fixtures; network used (Ethereum Sepolia
  settlement, mainnet chains for data); cost per call and floor price; limitations; credential handling.
- [ ] **16. Evidence pack**: registrationId, request/receipt references, fixture report, load-test
  results, uptime history, ranking reference.
- [ ] **17. Public summary** with one call to action: "Build on our reserve intents: here's the fixture."
- [ ] **18. Submit** on the H2 website. Disclose the pre-hackathon code and the buyer app as ours.

---

## Fixtures

Layout: `fixtures/<mission>/<case>.json`. Each file holds:
- `mission`, `example_build` (the mission page's example name), `intent`
- `input` (the question or params)
- `mode`: `pinned` or `live`
- `expected`: exact values for pinned; rules for live

Two modes:
- **pinned**: fixed past block and report date (archive RPC), exact expected numbers that never drift.
- **live**: checks rules that always hold: ratio = reserves / supply within tolerance; every figure has
  provenance; verdict matches ratio and age; response under 5 s.

Cases for each mission: two or three normal ones, plus failures:
- stale report -> `unverified`
- unknown asset -> clean refusal
- RPCs disagree -> answer withheld
- unclear question -> handled sensibly

One command: `npm run fixtures -- --mission exchange --target <url|telegraph>`
prints pass/fail and writes `fixtures/report.md`. Also add `npm run try -- <asset>` for any asset.

Missions to cover (claim only these):
- Stablecoin: "Treasury agents choosing on evidence"
- Exchange: "Solvency handshake"
- Asset Management: daily holdings proof / supply checks

## Demo video outline (about 3.5 minutes)
1. 0:00–0:20 The problem: an agent must know a token is backed before accepting it.
2. 0:20–1:10 A routed, paid call: verdict, authoritative figures, block numbers, receipt.
3. 1:10–2:00 The three mission fixtures passing.
4. 2:00–2:40 Failure cases: stale, unknown, RPC disagreement.
5. 2:40–3:10 Reliability: uptime history, p95 latency, cost per call.
6. 3:10–3:30 Limitations, testnet label, call to action.
