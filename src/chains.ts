export interface Chain {
  rpcs: string[];
  multicall: boolean;
}

// Tron speaks eth_call but has no Multicall3 at the canonical address.
export const CHAINS: Record<string, Chain> = {
  ethereum: { rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com", "https://rpc.mevblocker.io", "https://1rpc.io/eth", "https://eth.drpc.org"], multicall: true },
  base: { rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://1rpc.io/base", "https://base.drpc.org"], multicall: true },
  arbitrum: { rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com", "https://1rpc.io/arb", "https://arbitrum.drpc.org"], multicall: true },
  optimism: { rpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com", "https://1rpc.io/op", "https://optimism.drpc.org"], multicall: true },
  polygon: { rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com", "https://1rpc.io/matic", "https://polygon.drpc.org"], multicall: true },
  bsc: { rpcs: ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com", "https://1rpc.io/bnb", "https://bsc.drpc.org"], multicall: true },
  avalanche: { rpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com", "https://1rpc.io/avax/c", "https://avalanche.drpc.org"], multicall: true },
  ink: { rpcs: ["https://rpc-gel.inkonchain.com", "https://ink-rpc.publicnode.com", "https://ink.drpc.org"], multicall: true },
  plasma: { rpcs: ["https://rpc.plasma.to", "https://plasma.drpc.org"], multicall: true },
  mantle: { rpcs: ["https://rpc.mantle.xyz", "https://mantle-rpc.publicnode.com"], multicall: true },
  sepolia: { rpcs: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"], multicall: true },
  tron: { rpcs: ["https://api.trongrid.io/jsonrpc", "https://tron-evm-rpc.publicnode.com"], multicall: false },
};

const ALCHEMY: Record<string, string> = {
  ethereum: "eth-mainnet",
  base: "base-mainnet",
  arbitrum: "arb-mainnet",
  optimism: "opt-mainnet",
  polygon: "polygon-mainnet",
  bsc: "bnb-mainnet",
  avalanche: "avax-mainnet",
  ink: "ink-mainnet",
  mantle: "mantle-mainnet",
  sepolia: "eth-sepolia",
};

let keyed = false;

// Puts the keyed endpoint first on each chain; public RPCs stay as the fallback.
export function useAlchemy(key?: string) {
  if (keyed || !key) return;
  keyed = true;
  for (const [chain, host] of Object.entries(ALCHEMY)) CHAINS[chain].rpcs.unshift(`https://${host}.g.alchemy.com/v2/${key}`);
}
