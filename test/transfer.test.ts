import { encodeAbiParameters, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, type Env } from "../src/index";
import { buildTransfer, verifyCached, verifyTransfer } from "../src/transfer";

const now = new Date("2026-11-01T12:00:00Z");
const hash = `0x${"a".repeat(64)}`;
const tx = { from: "0x1111111111111111111111111111111111111111", to: "0x2222222222222222222222222222222222222222", value: "0x0", blockNumber: "0x64" };
const block = { timestamp: "0x65000000" };
const row = { token: "USDC", token_contract: "0xabc", from: "0x1", to: "0x2", amount_raw: "2500000", amount: 2.5, decimals: 6 };
const raw = (status: string, latest = 200, value = "0x0") => ({ tx: { ...tx, value }, receipt: { status, blockNumber: "0x64", logs: [] }, latest, block });

beforeEach(() => vi.unstubAllGlobals());

// failToken says which RPCs refuse token reads, as a rate limit would.
function stubBatch(log: object, failToken: (url: string) => boolean = () => false) {
  const results: Record<string, unknown> = { eth_getTransactionByHash: tx, eth_getTransactionReceipt: { status: "0x1", blockNumber: "0x64", logs: [log] }, eth_blockNumber: "0xc8", eth_getBlockByNumber: block };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const batch = JSON.parse(init.body as string) as { id: number; method: string; params: any[] }[];
    if (batch[0].method === "eth_call" && failToken(url)) return new Response("{}", { status: 429 });
    return new Response(JSON.stringify(batch.map(({ id, method, params }) => {
      if (method !== "eth_call") return { id, result: results[method] };
      const isSymbol = params[0].data === "0x95d89b41";
      return { id, result: isSymbol ? encodeAbiParameters([{ type: "string" }], ["USDC"]) : (`0x${"6".padStart(64, "0")}` as Hex) };
    })));
  }));
}

describe("buildTransfer", () => {
  it("verifies a settled token transfer", () => {
    const out = buildTransfer("ethereum", hash, raw("0x1"), [row], now);
    expect(out).toMatchObject({ verdict: "verified", status: "success", token: "USDC", amount: 2.5, amount_raw: "2500000", block_number: 100, confirmations: 101, network: "mainnet" });
  });
  it("reports native value", () => {
    const out = buildTransfer("ethereum", hash, raw("0x1", 200, "0xde0b6b3a7640000"), [], now);
    expect(out).toMatchObject({ verdict: "verified", token: "ETH", amount: 1, from: tx.from, to: tx.to });
  });
  it("marks a reverted transaction failed and claims nothing moved", () => {
    const out = buildTransfer("ethereum", hash, raw("0x0"), [row], now);
    expect(out).toMatchObject({ verdict: "failed", status: "reverted", amount: null, transfers: [] });
  });
  it("holds back an unsettled transfer", () => {
    const out = buildTransfer("ethereum", hash, raw("0x1", 101), [row], now);
    expect(out).toMatchObject({ verdict: "unverified", confirmations: 2 });
    expect(out.reason).toContain("required confirmations");
  });
  it("does not call a call with no value a transfer", () => {
    expect(buildTransfer("ethereum", hash, raw("0x1"), [], now).verdict).toBe("unverified");
  });
  it("reports pending, not found and unreadable distinctly", () => {
    expect(buildTransfer("ethereum", hash, { tx, receipt: null, latest: 1, block: null }, [], now).status).toBe("pending");
    expect(buildTransfer("ethereum", hash, null, [], now).status).toBe("not_found");
    expect(buildTransfer("ethereum", hash, null, [], now, "every RPC failed").status).toBe("unread");
  });
  it("labels Sepolia as testnet", () => {
    expect(buildTransfer("sepolia", hash, raw("0x1"), [row], now).network).toBe("testnet");
  });
});

describe("verifyTransfer", () => {
  it("decodes an ERC-20 Transfer log with token details", async () => {
    const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const pad = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
    const log = { address: "0x3333333333333333333333333333333333333333", topics: [topic, pad(tx.from), pad(tx.to)], data: `0x${(2500000).toString(16).padStart(64, "0")}` };
    stubBatch(log);
    const out = await verifyTransfer("ethereum", hash, now);
    expect(out).toMatchObject({ verdict: "verified", token: "USDC", amount: 2.5, to: tx.to, from: tx.from });
  });
  it("recovers token details when the first RPC rate-limits them", async () => {
    const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const pad = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
    const log = { address: "0x3333333333333333333333333333333333333333", topics: [topic, pad(tx.from), pad(tx.to)], data: `0x${(2500000).toString(16).padStart(64, "0")}` };
    let first: string | undefined;
    stubBatch(log, (url) => {
      first ??= url;
      return url === first;
    });
    expect(await verifyTransfer("ethereum", hash, now)).toMatchObject({ token: "USDC", amount: 2.5 });
  });
  it("answers unread when every RPC fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await verifyTransfer("ethereum", hash, now)).toMatchObject({ status: "unread", verdict: "unverified" });
  });
});

describe("verifyCached", () => {
  const hit = { get: async () => ({ verdict: "verified" }), put: vi.fn() } as unknown as KVNamespace;
  it("serves a stored result with no chain read", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await verifyCached(hit, "ethereum", hash, vi.fn())).toEqual({ verdict: "verified" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not store an unread answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const put = vi.fn();
    const kv = { get: async () => null, put } as unknown as KVNamespace;
    await verifyCached(kv, "ethereum", hash, vi.fn());
    expect(put).not.toHaveBeenCalled();
  });
});

describe("GET /transfer", () => {
  const env = {} as Env;
  it("refuses a malformed hash", async () => {
    const res = await app.request("/transfer?chain=ethereum&tx_hash=abc", {}, env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).error.code).toBe("BAD_TX_HASH");
  });
  it("refuses an unsupported chain", async () => {
    const res = await app.request(`/transfer?chain=dogecoin&tx_hash=${hash}`, {}, env);
    expect(((await res.json()) as any).error.code).toBe("UNSUPPORTED_CHAIN");
  });
});
