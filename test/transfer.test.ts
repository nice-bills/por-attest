import { encodeAbiParameters, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, type Env } from "../src/index";
import { buildTransfer, verifyTransfer } from "../src/transfer";

const now = new Date("2026-11-01T12:00:00Z");
const hash = `0x${"a".repeat(64)}`;
const tx = { from: "0x1111111111111111111111111111111111111111", to: "0x2222222222222222222222222222222222222222", value: "0x0", blockNumber: "0x64" };
const block = { timestamp: "0x65000000" };
const row = { token: "USDC", token_contract: "0xabc", from: "0x1", to: "0x2", amount_raw: "2500000", amount: 2.5, decimals: 6 };
const raw = (status: string, latest = 200, value = "0x0") => ({ tx: { ...tx, value }, receipt: { status, blockNumber: "0x64", logs: [] }, latest, block });

beforeEach(() => vi.unstubAllGlobals());

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
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const { method, params } = JSON.parse(init.body as string);
      const results: Record<string, unknown> = { eth_getTransactionByHash: tx, eth_getTransactionReceipt: { status: "0x1", blockNumber: "0x64", logs: [log] }, eth_blockNumber: "0xc8", eth_getBlockByNumber: block };
      if (method === "eth_call") {
        const isSymbol = params[0].data === "0x95d89b41";
        return new Response(JSON.stringify({ result: isSymbol ? encodeAbiParameters([{ type: "string" }], ["USDC"]) : (`0x${"6".padStart(64, "0")}` as Hex) }));
      }
      return new Response(JSON.stringify({ result: results[method] }));
    }));
    const out = await verifyTransfer("ethereum", hash, now);
    expect(out).toMatchObject({ verdict: "verified", token: "USDC", amount: 2.5, to: tx.to, from: tx.from });
  });
  it("answers unread when every RPC fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await verifyTransfer("ethereum", hash, now)).toMatchObject({ status: "unread", verdict: "unverified" });
  });
});

describe("GET /transfer", () => {
  const env = {} as Env;
  it("refuses a malformed hash", async () => {
    const res = await app.request("/transfer?chain=ethereum&tx_hash=abc", {}, env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe("BAD_TX_HASH");
  });
  it("refuses an unsupported chain", async () => {
    const res = await app.request(`/transfer?chain=dogecoin&tx_hash=${hash}`, {}, env);
    expect(((await res.json()) as any).error.code).toBe("UNSUPPORTED_CHAIN");
  });
});
