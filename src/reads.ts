import { decodeFunctionResult, encodeFunctionData, formatUnits, parseAbi, parseUnits, type Hex } from "viem";
import { CHAINS } from "./chains";
import { BRIDGED, type Asset, type FeedAsset, type TokenRef } from "./catalog";
import { readChain, type Call, type ChainRead } from "./rpc";
import { readSolana, type SolanaJob } from "./solana";

const abi = parseAbi([
  "function getRoundData(uint80) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

export interface SupplyRead {
  chain: string;
  token: string;
  decimals: number;
  total_supply: number;
  treasury_balance: number;
  circulating: number;
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

// Counts each chain+token once and leaves bridged copies out of the total.
export function counted(rows: SupplyRead[]): SupplyRead[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.chain}:${row.token.toLowerCase()}`;
    if (seen.has(key) || BRIDGED.has(row.token.toLowerCase())) return false;
    seen.add(key);
    return true;
  });
}

// Summed at 18 decimals so a large cross-chain total keeps its low digits.
export function sumCirculating(rows: SupplyRead[]): number {
  const total = rows.reduce((sum, row) => sum + parseUnits(row.circulating.toFixed(6), 18), 0n);
  return Number(formatUnits(total, 18));
}

const encode = (fn: "latestRoundData" | "decimals" | "totalSupply" | "symbol", to: string): Call => ({
  to,
  data: encodeFunctionData({ abi, functionName: fn }),
});

export async function readAssets(assets: Asset[], solanaUrl?: string): Promise<Reads> {
  const byChain = new Map<string, { call: Call; apply: (hex: Hex | null, at: ChainRead) => void }[]>();
  const reads: Reads = {};
  const solana: SolanaJob[] = [];
  const add = (chain: string, call: Call, apply: (hex: Hex | null, at: ChainRead) => void) => {
    byChain.set(chain, [...(byChain.get(chain) ?? []), { call, apply }]);
  };

  for (const asset of assets) {
    const read: AssetRead = { supply: [], unread: [] };
    reads[asset.key] = read;
    if (asset.kind === "feed") addFeed(asset.feed, asset.chain, read, add);
    for (const token of asset.tokens) {
      if (token.chain === "solana") {
        solana.push({ mint: token.token, read });
        continue;
      }
      if (!CHAINS[token.chain]) {
        read.unread.push({ chain: token.chain, reason: "no reader for this chain" });
        continue;
      }
      addToken(token, read, add);
    }
  }

  await Promise.all([
    readSolana(solana, solanaUrl),
    ...[...byChain].map(async ([chain, jobs]) => {
      const at = await readChain(CHAINS[chain].rpcs, jobs.map((j) => j.call), CHAINS[chain].multicall);
      jobs.forEach((job, i) => job.apply(at.failure ? null : at.results[i], at));
    }),
  ]);
  return reads;
}

// Audit read for one past round. Rounds never change, so this needs no archive node.
export async function readRound(asset: FeedAsset, roundId: string): Promise<AssetRead> {
  const calls = [
    encode("decimals", asset.feed),
    { to: asset.feed, data: encodeFunctionData({ abi, functionName: "getRoundData", args: [BigInt(roundId)] }) },
  ];
  const at = await readChain(CHAINS[asset.chain].rpcs, calls, CHAINS[asset.chain].multicall);
  const [decimals, round] = at.results;
  if (at.failure || !decimals || !round) return { supply: [], unread: [{ chain: asset.chain, reason: at.failure ?? "round not found" }] };
  const [id, answer, , updatedAt] = decodeFunctionResult({ abi, functionName: "getRoundData", data: round });
  return {
    feed: {
      answer_raw: answer.toString(),
      round_id: id.toString(),
      decimals: Number(decodeFunctionResult({ abi, functionName: "decimals", data: decimals })),
      updated_at_unix: Number(updatedAt),
      block_number: at.block_number,
      block_timestamp: at.block_timestamp,
    },
    supply: [],
    unread: [],
  };
}

// For a contract outside our list. Reads on request, since no snapshot holds it.
export async function readToken(chain: string, token: string): Promise<{ symbol: string; read: AssetRead }> {
  const calls = [encode("totalSupply", token), encode("decimals", token), encode("symbol", token)];
  const at = await readChain(CHAINS[chain].rpcs, calls, CHAINS[chain].multicall);
  const [total, decimals, symbol] = at.results;
  if (at.failure || !total || !decimals) return { symbol: token, read: { supply: [], unread: [{ chain, reason: at.failure ?? "not a token contract on this chain" }] } };
  const places = Number(decodeFunctionResult({ abi, functionName: "decimals", data: decimals }));
  const amount = Number(formatUnits(decodeFunctionResult({ abi, functionName: "totalSupply", data: total }), places));
  return {
    symbol: symbol ? decodeFunctionResult({ abi, functionName: "symbol", data: symbol }) : token,
    read: { supply: [{ chain, token, decimals: places, total_supply: amount, treasury_balance: 0, circulating: amount, block_number: at.block_number, block_timestamp: at.block_timestamp }], unread: [] },
  };
}

type Add = (chain: string, call: Call, apply: (hex: Hex | null, at: ChainRead) => void) => void;

function addFeed(address: string, chain: string, read: AssetRead, add: Add) {
  let decimals: number | undefined;
  add(chain, encode("decimals", address), (hex) => {
    if (hex) decimals = Number(decodeFunctionResult({ abi, functionName: "decimals", data: hex }));
  });
  add(chain, encode("latestRoundData", address), (hex, at) => {
    if (!hex || decimals === undefined) {
      read.unread.push({ chain, reason: at.failure ?? "feed read failed" });
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
  let held = 0n;
  for (const wallet of token.treasury ?? []) {
    const data = encodeFunctionData({ abi, functionName: "balanceOf", args: [wallet as Hex] });
    add(token.chain, { to: token.token, data }, (hex) => {
      if (hex) held += decodeFunctionResult({ abi, functionName: "balanceOf", data: hex });
    });
  }
  // Jobs apply in order, so the balances above are in by the time this runs.
  add(token.chain, encode("totalSupply", token.token), (hex, at) => {
    if (!hex) {
      read.unread.push({ chain: token.chain, reason: at.failure ?? "totalSupply read failed" });
      return;
    }
    const total = decodeFunctionResult({ abi, functionName: "totalSupply", data: hex });
    read.supply.push({
      chain: token.chain,
      token: token.token,
      decimals: token.decimals,
      total_supply: Number(formatUnits(total, token.decimals)),
      treasury_balance: Number(formatUnits(held, token.decimals)),
      circulating: Number(formatUnits(total - held, token.decimals)),
      block_number: at.block_number,
      block_timestamp: at.block_timestamp,
    });
  });
}
