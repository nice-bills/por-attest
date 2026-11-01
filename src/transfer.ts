import { decodeFunctionResult, encodeFunctionData, formatUnits, parseAbi, type Hex } from "viem";
import { CHAINS } from "./chains";
import { rpcBatch } from "./rpc";

const INTENT = "CRYPTO_TRANSFER_VERIFY_GENERAL";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const MIN_CONFIRMATIONS = 12;
const MAX_TOKENS = 5;
const NATIVE: Record<string, string> = { ethereum: "ETH", base: "ETH", arbitrum: "ETH", optimism: "ETH", ink: "ETH", sepolia: "ETH", polygon: "POL", bsc: "BNB", avalanche: "AVAX", mantle: "MNT", plasma: "XPL" };
const abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

export const TRANSFER_CHAINS = Object.keys(NATIVE);

export interface TokenTransfer {
  token: string;
  token_contract: string | null;
  from: string;
  to: string;
  // uint256 can exceed the safe integer range, so the exact value stays a string.
  amount_raw: string;
  amount: number | null;
  decimals: number | null;
}

interface Raw {
  tx: any;
  receipt: any;
  latest: number;
  block: any;
}

const address = (topic: string) => `0x${topic.slice(-40)}`;

async function readTx(url: string, hash: string): Promise<Raw | null> {
  const [tx, receipt, latest] = await rpcBatch(url, [
    ["eth_getTransactionByHash", [hash]],
    ["eth_getTransactionReceipt", [hash]],
    ["eth_blockNumber", []],
  ]);
  if (!tx) return null;
  const [block] = tx.blockNumber ? await rpcBatch(url, [["eth_getBlockByNumber", [tx.blockNumber, false]]]) : [null];
  return { tx, receipt, latest: Number(latest), block };
}

// Works down the RPC list, because one rate-limited read would otherwise lose the token and amount.
async function tokenInfo(urls: string[], token: string) {
  const call = (functionName: "symbol" | "decimals") => ["eth_call", [{ to: token, data: encodeFunctionData({ abi, functionName }) }, "latest"]] as [string, unknown[]];
  for (const url of urls) {
    try {
      const [symbol, decimals] = await rpcBatch(url, [call("symbol"), call("decimals")]);
      return {
        symbol: String(decodeFunctionResult({ abi, functionName: "symbol", data: symbol as Hex })),
        decimals: Number(decodeFunctionResult({ abi, functionName: "decimals", data: decimals as Hex })),
      };
    } catch (err) {
      console.error("token read failed", url.slice(0, 32), String(err).slice(0, 100));
    }
  }
  return { symbol: null, decimals: null };
}

export async function erc20Transfers(urls: string[], logs: any[]): Promise<TokenTransfer[]> {
  const rows = logs.filter((l) => l.topics?.[0] === TRANSFER_TOPIC && l.topics.length === 3);
  const tokens = [...new Set(rows.map((l) => l.address.toLowerCase()))].slice(0, MAX_TOKENS);
  const info = new Map(await Promise.all(tokens.map(async (t) => [t, await tokenInfo(urls, t)] as const)));
  return rows.flatMap((l) => {
    const known = info.get(l.address.toLowerCase());
    if (!known) return [];
    const raw = BigInt(l.data);
    return [{
      token: known.symbol ?? l.address,
      token_contract: l.address,
      from: address(l.topics[1]),
      to: address(l.topics[2]),
      amount_raw: raw.toString(),
      amount: known.decimals === null ? null : Number(formatUnits(raw, known.decimals)),
      decimals: known.decimals,
    }];
  });
}

export function buildTransfer(chain: string, hash: string, raw: Raw | null, transfers: TokenTransfer[], now: Date, failure?: string) {
  const base = { intent: INTENT, chain, network: chain === "sepolia" ? "testnet" : "mainnet", tx_hash: hash, as_of: now.toISOString() };
  const empty = { from: null, to: null, token: null, token_contract: null, amount: null, amount_raw: null, block_number: null, block_timestamp: null, confirmations: 0, transfers: [] };
  if (!raw) {
    const status = failure ? "unread" : "not_found";
    const reason = failure ?? `No transaction with this hash was found on ${chain}.`;
    return { ...base, ...empty, verdict: "unverified", confidence: 0, status, summary: `Transfer ${hash} on ${chain} is unverified: ${failure ? "the chain could not be read" : "no such transaction was found"}.`, reason };
  }
  const { tx, receipt, latest, block } = raw;
  if (!receipt) {
    return { ...base, ...empty, from: tx.from, verdict: "unverified", confidence: 0, status: "pending", summary: `Transfer ${hash} on ${chain} is unverified: it has not been mined yet.`, reason: "The transaction is known but has no receipt yet." };
  }
  const blockNumber = Number(receipt.blockNumber);
  const confirmations = Math.max(0, latest - blockNumber + 1);
  const success = receipt.status === "0x1";
  const value = BigInt(tx.value);
  const native: TokenTransfer | null = value > 0n ? { token: NATIVE[chain], token_contract: null, from: tx.from, to: tx.to, amount_raw: value.toString(), amount: Number(formatUnits(value, 18)), decimals: 18 } : null;
  const moved = success ? [...(native ? [native] : []), ...transfers] : [];
  const main = moved[0];
  const settled = confirmations >= MIN_CONFIRMATIONS;
  const verdict = !success ? "failed" : !main || !settled ? "unverified" : "verified";
  const why = !success ? "the transaction reverted, so nothing moved" : !main ? "the transaction succeeded but moved no value" : !settled ? `it has ${confirmations} of ${MIN_CONFIRMATIONS} required confirmations` : "";
  const when = block ? new Date(Number(block.timestamp) * 1000).toISOString() : null;
  const what = main ? `${main.amount ?? main.amount_raw} ${main.token} from ${main.from} to ${main.to}` : "no value";
  return {
    ...base,
    verdict,
    confidence: verdict === "verified" ? 0.95 : verdict === "failed" ? 0.95 : 0,
    status: success ? "success" : "reverted",
    summary: `Transfer on ${chain} is ${verdict}: ${why || what}, block ${blockNumber}, ${confirmations} confirmations.`,
    reason: `Read from the transaction receipt on ${chain}${why ? `; ${why}` : ""}. ${moved.length} transfer(s) found.`,
    from: main?.from ?? tx.from,
    to: main?.to ?? tx.to,
    token: main?.token ?? null,
    token_contract: main?.token_contract ?? null,
    amount: main?.amount ?? null,
    amount_raw: main?.amount_raw ?? null,
    block_number: blockNumber,
    block_timestamp: when,
    confirmations,
    transfers: moved,
  };
}

// Settled results never change, so each is read from the chain once.
export async function verifyCached(kv: KVNamespace, chain: string, hash: string, wait: (p: Promise<unknown>) => void) {
  const key = `transfer:${chain}:${hash.toLowerCase()}`;
  const stored = await kv.get(key, "json").catch(() => null);
  if (stored) return stored;
  const answer = await verifyTransfer(chain, hash);
  const complete = answer.transfers.every((t) => t.amount !== null);
  if ((answer.verdict === "verified" || answer.verdict === "failed") && complete) wait(kv.put(key, JSON.stringify(answer)).catch(console.error));
  return answer;
}

// Per-transaction by nature, so unlike /reserve this reads on request, with RPC timeouts and fallback.
export async function verifyTransfer(chain: string, hash: string, now = new Date()) {
  const failure = "every RPC failed";
  let missing = false;
  for (const url of CHAINS[chain].rpcs) {
    try {
      const raw = await readTx(url, hash);
      if (!raw) {
        // Two RPCs agreeing it is absent is an answer; stop rather than work down the list.
        if (missing) break;
        missing = true;
        continue;
      }
      return buildTransfer(chain, hash, raw, raw.receipt?.status === "0x1" ? await erc20Transfers(CHAINS[chain].rpcs, raw.receipt.logs) : [], now);
    } catch (err) {
      console.error("transfer read failed", url.slice(0, 32), String(err).slice(0, 100));
    }
  }
  return buildTransfer(chain, hash, null, [], now, missing ? undefined : failure);
}
