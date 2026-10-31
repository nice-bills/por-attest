import { decodeFunctionResult, encodeFunctionData, parseAbi, type Hex } from "viem";

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const multicallAbi = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calls) view returns (Result[])",
]);

export interface Call {
  to: string;
  data: Hex;
}

export interface ChainRead {
  block_number: number;
  block_timestamp: string;
  results: (Hex | null)[];
  // Set when no answer from this chain should be used; says why.
  failure?: string;
}

const TIMEOUT_MS = 4_000;
// Two RPCs read a moment apart can differ by a block; beyond this they disagree on the value.
const DISAGREE_TOLERANCE = 0.005;

const words = (hex: Hex | null) => (hex ?? "0x").slice(2).match(/.{64}/g)?.map((w) => BigInt(`0x${w}`)) ?? [];

export function disagrees(a: (Hex | null)[], b: (Hex | null)[]): boolean {
  return a.some((hex, i) => {
    if (!hex || !b[i]) return false;
    const other = words(b[i]);
    return words(hex).some((x, j) => {
      const y = other[j] ?? 0n;
      const gap = x > y ? x - y : y - x;
      const top = x > y ? x : y;
      return top > 0n && Number((gap * 1_000_000n) / top) / 1_000_000 > DISAGREE_TOLERANCE;
    });
  });
}

// Reads from two RPCs: either alone will do, but if both answer they must agree.
export async function readChain(urls: string[], calls: Call[], multicall: boolean): Promise<ChainRead> {
  const [first, second] = await Promise.allSettled(urls.slice(0, 2).map((url) => readCalls(url, calls, multicall)));
  const ok = [first, second].flatMap((r) => (r?.status === "fulfilled" ? [r.value] : []));
  const best = ok.sort((x, y) => y.results.filter(Boolean).length - x.results.filter(Boolean).length)[0];
  if (!best) return { block_number: 0, block_timestamp: "", results: calls.map(() => null), failure: "every RPC failed" };
  if (ok.length === 2 && disagrees(ok[0].results, ok[1].results)) return { ...best, failure: "RPCs disagree" };
  return best;
}

export async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}`);
  const body = (await res.json()) as { result?: any; error?: { message?: string } };
  if (body.error) throw new Error(`${method}: ${body.error.message ?? "rpc error"}`);
  return body.result;
}

export async function readCalls(url: string, calls: Call[], multicall: boolean): Promise<ChainRead> {
  const block = await rpc(url, "eth_getBlockByNumber", ["latest", false]);
  const tag = block.number as string;
  const results = multicall ? await viaMulticall(url, calls, tag) : await oneByOne(url, calls);
  return {
    block_number: Number(block.number),
    block_timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    results,
  };
}

async function viaMulticall(url: string, calls: Call[], tag: string): Promise<(Hex | null)[]> {
  const data = encodeFunctionData({
    abi: multicallAbi,
    functionName: "aggregate3",
    args: [calls.map((c) => ({ target: c.to as Hex, allowFailure: true, callData: c.data }))],
  });
  const raw = await rpc(url, "eth_call", [{ to: MULTICALL3, data }, tag]);
  const decoded = decodeFunctionResult({ abi: multicallAbi, functionName: "aggregate3", data: raw });
  return decoded.map((r) => (r.success && r.returnData !== "0x" ? r.returnData : null));
}

async function oneByOne(url: string, calls: Call[]): Promise<(Hex | null)[]> {
  // Non-multicall chains (Tron) only answer eth_call at "latest", so tag is not used.
  const out = await Promise.allSettled(calls.map((c) => rpc(url, "eth_call", [c, "latest"])));
  return out.map((r) => (r.status === "fulfilled" && r.value !== "0x" ? (r.value as Hex) : null));
}
