# por-attest

An agent about to accept a token needs to know one thing: is it backed right now?

por-attest is a Telegraph miner that answers that for 80 assets: 74 with Chainlink Proof of Reserve
feeds, plus USDC, USDT, XAUT, PAXG, PYUSD and USDe from issuer reports. The answer leads with the
authoritative figure, either the Chainlink round or the issuer's own report, and gives its date and
source. Our live on-chain read sits in a separate field and never changes that headline.

When the evidence is stale, unreadable or contradictory, the answer is `unverified` with a reason.
It never guesses, and two RPCs that disagree mean the figures are withheld.

It also verifies token supply across chains and single on-chain transfers from their receipts.
Fixtures for seven missions cover normal cases and failures, and anyone can rerun them with one command. Payment runs on the Ethereum Sepolia testnet; the data
comes from mainnet chains. Our demo buyer app is labelled as ours.

**Build on our reserve intents: here's the fixture.**
`npm run fixtures -- --mission exchange`
