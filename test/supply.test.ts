import { describe, expect, it } from "vitest";
import { findAsset } from "../src/catalog";
import { app } from "../src/index";
import { buildSupply } from "../src/supply";

const now = new Date("2026-10-31T12:00:00Z");
const row = (chain: string, n: number) => ({ chain, token: "0x1", decimals: 6, total_supply: n, treasury_balance: 0, circulating: n, block_number: 7, block_timestamp: now.toISOString() });
const usdc = findAsset("USDC")!;

describe("buildSupply", () => {
  it("totals chains and keeps block provenance on each", () => {
    const out = buildSupply(usdc, { supply: [row("ethereum", 10), row("base", 5)], unread: [] }, now);
    expect(out.total_supply).toBe(15);
    expect(out.complete).toBe(true);
    expect(out.chains[0]).toMatchObject({ chain: "ethereum", block_number: 7, block_timestamp: now.toISOString() });
  });
  it("marks a partial read", () => {
    const out = buildSupply(usdc, { supply: [row("base", 5)], unread: [{ chain: "solana", reason: "x" }] }, now);
    expect(out.complete).toBe(false);
    expect(out.reason).toContain("solana");
  });
  it("filters to one chain", () => {
    const out = buildSupply(usdc, { supply: [row("ethereum", 10), row("base", 5)], unread: [] }, now, "base");
    expect(out.total_supply).toBe(5);
  });
  it("answers unverified when nothing could be read", () => {
    const out = buildSupply(usdc, { supply: [], unread: [{ chain: "ethereum", reason: "x" }] }, now);
    expect(out.verdict).toBe("unverified");
    expect(out.total_supply).toBeNull();
  });
});

describe("GET /supply", () => {
  it("needs an asset", async () => {
    const res = await app.request("/supply");
    expect(res.status).toBe(400);
  });
  it("refuses an unknown asset", async () => {
    const res = await app.request("/supply?asset=FAKECOIN");
    expect(res.status).toBe(404);
  });
});
