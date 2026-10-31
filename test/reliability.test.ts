import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import { buildAnswer } from "../src/answer";
import { findAsset } from "../src/catalog";
import worker, { app, type Env } from "../src/index";
import { disagrees, readChain } from "../src/rpc";
import { needsRefresh, readFor, resetSnapshotCache, type Snapshot } from "../src/snapshot";

const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const now = new Date("2026-10-31T12:00:00Z");

function kv(value: unknown = null) {
  return { get: vi.fn(async () => value), put: vi.fn(async () => {}) } as unknown as KVNamespace;
}
const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
const snapshot = (at: string): Snapshot => ({ generated_at: at, reads: {}, reports: {} });

function mockRpc(handler: (url: string, body: any) => unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const result = handler(url, JSON.parse(init.body as string));
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify({ result }));
  }));
}

beforeEach(() => {
  resetSnapshotCache();
  vi.unstubAllGlobals();
});

describe("disagrees", () => {
  it("accepts reads a block apart", () => {
    expect(disagrees([word(1_000_000n)], [word(1_000_100n)])).toBe(false);
  });
  it("catches a real difference", () => {
    expect(disagrees([word(1_000_000n)], [word(1_100_000n)])).toBe(true);
  });
  it("ignores a side that returned nothing", () => {
    expect(disagrees([null], [word(5n)])).toBe(false);
  });
});

describe("readChain", () => {
  const call = { to: "0x1", data: "0x18160ddd" as Hex };
  const block = { number: "0x10", timestamp: "0x65000000" };

  it("falls back when the first RPC fails", async () => {
    mockRpc((url, body) => (url === "a" ? new Error("down") : body.method === "eth_call" ? word(9n) : block));
    const out = await readChain(["a", "b"], [call], false);
    expect(out.failure).toBeUndefined();
    expect(out.results[0]).toBe(word(9n));
  });
  it("withholds when both answer differently", async () => {
    mockRpc((url, body) => (body.method === "eth_call" ? word(url === "a" ? 100n : 200n) : block));
    expect((await readChain(["a", "b"], [call], false)).failure).toBe("RPCs disagree");
  });
  it("reports total failure without throwing", async () => {
    mockRpc(() => new Error("down"));
    const out = await readChain(["a", "b"], [call], false);
    expect(out.failure).toBe("every RPC failed");
    expect(out.results).toEqual([null]);
  });
});

describe("snapshot use", () => {
  it("refreshes only when overdue, and only once", () => {
    expect(needsRefresh(snapshot("2026-10-31T11:59:00Z"), now)).toBe(false);
    expect(needsRefresh(snapshot("2026-10-31T11:50:00Z"), now)).toBe(true);
    expect(needsRefresh(snapshot("2026-10-31T11:50:00Z"), now)).toBe(false);
  });
  it("gives a reasoned empty read when there is no snapshot", () => {
    const out = buildAnswer(findAsset("WBTC")!, readFor(null, findAsset("WBTC")!), now, null);
    expect(out.verdict).toBe("unverified");
    expect(out.reason).toContain("no snapshot available");
  });
  it("withholds a disputed feed", () => {
    const out = buildAnswer(findAsset("WBTC")!, { supply: [], unread: [{ chain: "ethereum", reason: "RPCs disagree" }] }, now, null);
    expect(out.verdict).toBe("unverified");
    expect(out.headline.reserves).toBeNull();
    expect(out.reason).toContain("RPCs disagree");
  });
  it("uses the fresher report held in the snapshot", () => {
    const report = { kind: "issuer_disclosure", attestor: null, report_date: "2026-10-31", cadence: "daily", stale_after_days: 3, report_url: "u", page_url: "u", reserves: 5, supply_reported: null };
    const out = buildAnswer(findAsset("USDe")!, { supply: [], unread: [] }, now, null, { snapshot_at: null, report });
    expect(out.headline.reserves).toBe(5);
  });
});

describe("request path", () => {
  it("does no RPC work, only reads KV", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const env = { POR_KV: kv(snapshot(new Date().toISOString())) } as Env;
    const res = await app.request("/reserve?asset=WBTC", {}, env, ctx);
    expect(res.status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("still answers 200 when KV throws", async () => {
    const env = { POR_KV: { get: async () => { throw new Error("kv down"); } } } as unknown as Env;
    const res = await app.request("/reserve?asset=USDC", {}, env, ctx);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).verdict).toBe("fully_backed");
  });
  it("turns an unexpected throw into an unverified 200", async () => {
    const res = await app.request("/reserve?asset=WBTC", {}, { POR_KV: null } as unknown as Env, ctx);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).verdict).toBe("unverified");
  });
  it("schedules the refresh from cron", async () => {
    const waitUntil = vi.fn();
    mockRpc(() => new Error("down"));
    await worker.scheduled({} as ScheduledController, { POR_KV: kv() } as Env, { waitUntil } as unknown as ExecutionContext);
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
  });
});
