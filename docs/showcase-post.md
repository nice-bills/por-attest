# Showcase post (20 Nov)

Update the numbers on the day. Check `https://github.com/nice-bills/por-attest/tree/uptime` first.

## Post

Before an agent accepts a token, it should know whether that token is backed.

por-attest is a @Telegraphprotoc miner that answers this for 80 assets: 74 Chainlink Proof of Reserve feeds, plus USDC, USDT, XAUT, PAXG, PYUSD and USDe.

The headline is always the source's own figure, with its date. If data is stale or sources disagree, you get `unverified` and a reason, never a guess.

Payment runs on Ethereum Sepolia testnet. Data comes from mainnet.

It also verifies token supply and single on-chain payments.

Building for Stablecoin, Exchange, Asset Management, Mining and Power, Consumer Automation, Model Economy or Web3 DeFi? Build on our reserve intents: here's the fixture.

https://github.com/nice-bills/por-attest

## Note to Apps teams

We serve `ASSET_RESERVE_ATTESTATION_GENERAL`, `TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL` and `CRYPTO_TRANSFER_VERIFY_GENERAL`. If your app needs a solvency or supply check, fixtures cover seven missions. Run one with:

`npm run fixtures -- --mission exchange`

Tell us which assets or failure cases you need and we'll add them. Your own calls would be independent use, which we'd credit as yours.
