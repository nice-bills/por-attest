import { decodeFunctionResult, encodeFunctionData, formatUnits, parseAbi, type Hex } from "viem";
import { CHAINS } from "./chains";
import type { Asset, TokenRef } from "./catalog";
import { readCalls, type Call, type ChainRead } from "./rpc";

const abi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

export interface SupplyRead {
  chain: string;
  token: string;
  decimals: number;
  total_supply: number;
  block_number: number;
  block_timestamp: string;
}

export interface FeedRead {
  // uint80/int256: these exceed Number.MAX_SAFE_INTEGER, so they stay strings.
  answer_raw: string;
  round_id: string;
  decimals: number;
  updated_at_unix: number;
  block_number: number;
  block_timestamp: string;
}

export interface AssetRead {
  feed?: FeedRead;
  supply: SupplyRead[];
  unread: { chain: string; reason: string }[];
}

export type Reads = Record<string, AssetRead>;

const encode = (fn: "latestRoundData" | "decimals" | "totalSupply", to: string): Call => ({
  to,
  data: encodeFunctionData({ abi, functionName: fn }),
});

export async function readAssets(assets: Asset[]): Promise<Reads> {
  const byChain = new Map<string, { call: Call; apply: (hex: Hex | null, at: ChainRead) => void }[]>();
  const reads: Reads = {};
  const add = (chain: string, call: Call, apply: (hex: Hex | null, at: ChainRead) => void) => {
    byChain.set(chain, [...(byChain.get(chain) ?? []), { call, apply }]);
  };

  for (const asset of assets) {
    const read: AssetRead = { supply: [], unread: [] };
    reads[asset.key] = read;
    if (asset.kind === "feed") addFeed(asset.feed, asset.chain, read, add);
    for (const token of asset.tokens) {
      if (!CHAINS[token.chain]) {
        read.unread.push({ chain: token.chain, reason: "no reader for this chain" });
        continue;
      }
      addToken(token, read, add);
    }
  }

  await Promise.all(
    [...byChain].map(async ([chain, jobs]) => {
      const at = await readCalls(CHAINS[chain].rpcs[0], jobs.map((j) => j.call), CHAINS[chain].multicall);
      jobs.forEach((job, i) => job.apply(at.results[i], at));
    }),
  );
  return reads;
}

type Add = (chain: string, call: Call, apply: (hex: Hex | null, at: ChainRead) => void) => void;

function addFeed(address: string, chain: string, read: AssetRead, add: Add) {
  let decimals: number | undefined;
  add(chain, encode("decimals", address), (hex) => {
    if (hex) decimals = Number(decodeFunctionResult({ abi, functionName: "decimals", data: hex }));
  });
  add(chain, encode("latestRoundData", address), (hex, at) => {
    if (!hex || decimals === undefined) {
      read.unread.push({ chain, reason: "feed read failed" });
      return;
    }
    const [roundId, answer, , updatedAt] = decodeFunctionResult({ abi, functionName: "latestRoundData", data: hex });
    read.feed = {
      answer_raw: answer.toString(),
      round_id: roundId.toString(),
      decimals,
      updated_at_unix: Number(updatedAt),
      block_number: at.block_number,
      block_timestamp: at.block_timestamp,
    };
  });
}

function addToken(token: TokenRef, read: AssetRead, add: Add) {
  add(token.chain, encode("totalSupply", token.token), (hex, at) => {
    if (!hex) {
      read.unread.push({ chain: token.chain, reason: "totalSupply read failed" });
      return;
    }
    const raw = decodeFunctionResult({ abi, functionName: "totalSupply", data: hex });
    read.supply.push({
      chain: token.chain,
      token: token.token,
      decimals: token.decimals,
      total_supply: Number(formatUnits(raw, token.decimals)),
      block_number: at.block_number,
      block_timestamp: at.block_timestamp,
    });
  });
}
