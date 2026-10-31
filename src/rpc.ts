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
}

export async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
