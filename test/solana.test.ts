import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAsset } from "../src/catalog";
import { readAssets, type AssetRead } from "../src/reads";
import { readSolana } from "../src/solana";

const supply = { context: { slot: 400 }, value: { uiAmountString: "1234.5", decimals: 6 } };
const empty = (): AssetRead => ({ supply: [], unread: [] });

function stub(handler: (url: string) => unknown) {
  const fn = vi.fn(async (url: string) => {
    const result = handler(url);
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify({ result }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.unstubAllGlobals());

describe("readSolana", () => {
  it("reads the keyed RPC first and records slot provenance", async () => {
    const fn = stub(() => supply);
    const read = empty();
    await readSolana([{ mint: "M", read }], "https://keyed.example/abc");
    expect(fn.mock.calls[0][0]).toBe("https://keyed.example/abc");
    expect(read.supply[0]).toMatchObject({ chain: "solana", total_supply: 1234.5, block_number: 400 });
  });
  it("falls back to the public RPC", async () => {
    stub((url) => (url.includes("keyed") ? new Error("down") : supply));
    const read = empty();
    await readSolana([{ mint: "M", read }], "https://keyed.example/abc");
    expect(read.supply).toHaveLength(1);
  });
  it("records an unread chain without exposing the URL", async () => {
    stub(() => new Error("https://keyed.example/abc failed"));
    const read = empty();
    await readSolana([{ mint: "M", read }], "https://keyed.example/abc");
    expect(read.unread).toEqual([{ chain: "solana", reason: "getTokenSupply failed" }]);
    expect(JSON.stringify(read)).not.toContain("keyed");
  });
  it("runs as part of readAssets for assets with a Solana mint", async () => {
    const fn = stub(() => new Error("down"));
    const reads = await readAssets([findAsset("USDC")!], "https://keyed.example/abc");
    expect(fn.mock.calls.some((c) => c[0] === "https://keyed.example/abc")).toBe(true);
    expect(reads.USDC.unread.some((u) => u.chain === "solana")).toBe(true);
  });
});
