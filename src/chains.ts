export interface Chain {
  rpcs: string[];
  multicall: boolean;
}

// Tron speaks eth_call but has no Multicall3 at the canonical address.
export const CHAINS: Record<string, Chain> = {
  ethereum: { rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"], multicall: true },
  base: { rpcs: ["https://base-rpc.publicnode.com", "https://base.drpc.org"], multicall: true },
  arbitrum: { rpcs: ["https://arbitrum-one-rpc.publicnode.com", "https://arbitrum.drpc.org"], multicall: true },
  optimism: { rpcs: ["https://optimism-rpc.publicnode.com", "https://optimism.drpc.org"], multicall: true },
  polygon: { rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"], multicall: true },
  bsc: { rpcs: ["https://bsc-rpc.publicnode.com", "https://bsc.drpc.org"], multicall: true },
  avalanche: { rpcs: ["https://avalanche-c-chain-rpc.publicnode.com", "https://avalanche.drpc.org"], multicall: true },
  ink: { rpcs: ["https://rpc-gel.inkonchain.com", "https://ink.drpc.org"], multicall: true },
  plasma: { rpcs: ["https://rpc.plasma.to", "https://plasma.drpc.org"], multicall: true },
  mantle: { rpcs: ["https://mantle-rpc.publicnode.com", "https://rpc.mantle.xyz"], multicall: true },
  tron: { rpcs: ["https://api.trongrid.io/jsonrpc", "https://tron-evm-rpc.publicnode.com"], multicall: false },
};
