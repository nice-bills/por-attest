#!/usr/bin/env bash
# Registers por-attest on Ethereum Sepolia (testnet). Needs .env with a miner wallet holding
# Sepolia ETH for gas, and the current miner.yaml deployed.
set -euo pipefail
set -a; . ./.env; set +a

RPC=https://ethereum-sepolia-rpc.publicnode.com
DIAMOND=0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b
MACHINA=0xd68305cA83C7AF42A4F720144E7416fB53F8AaF4
USDC=0xcc194e1a843B658526D0D5C431f670028582Ae17
ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
YAML_URL=https://por-attest.alnicewilliams3.workers.dev/miner.yaml
MIN_PRICE=10000 # $0.01, the protocol minimum
send() { cast send --rpc-url "$RPC" --private-key "$MINER_PRIVATE_KEY" "$@"; }

# The on-chain hash must match what nodes fetch, or activation fails after gas is spent.
curl -fsS "$YAML_URL" | cmp - miner.yaml
YAML_HASH="0x$(sha256sum miner.yaml | cut -d' ' -f1)"

send "$USDC" "mint(address,uint256)" "$MINER_ADDRESS" 2000000
send "$USDC" "approve(address,uint256)" "$ROUTER" 2000000
send "$ROUTER" "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))" \
  "($USDC,$MACHINA,3000,$MINER_ADDRESS,2000000,0,0)"
send "$MACHINA" "approve(address,uint256)" "$DIAMOND" 10000000000000000000
send "$DIAMOND" "registerMiner(string,bytes32,address,uint256,string[])" \
  "$YAML_URL" "$YAML_HASH" "$MINER_ADDRESS" "$MIN_PRICE" \
  '["ASSET_RESERVE_ATTESTATION_GENERAL","TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL"]'
echo "Read registrationId from the MinerRegistered event, then check:"
echo "curl -s https://devnode.telegraphprotocol.com/api/miners/<registrationId>"
