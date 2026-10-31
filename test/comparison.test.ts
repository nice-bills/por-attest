import { describe, expect, it } from "vitest";
import { BRIDGED, ISSUERS, findAsset } from "../src/catalog";
import { buildAnswer } from "../src/answer";
import { counted, sumCirculating, type SupplyRead } from "../src/reads";
import { buildSupply } from "../src/supply";

const now = new Date("2026-10-31T12:00:00Z");
const row = (chain: string, token: string, total: number, treasury = 0): SupplyRead => ({
  chain, token, decimals: 6, total_supply: total, treasury_balance: treasury, circulating: total - treasury, block_number: 1, block_timestamp: now.toISOString(),
});

describe("cross-chain total", () => {
  const native = row("arbitrum", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 100);
  const bridged = row("arbitrum", "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", 40);

  it("has no double count: bridged copies and repeated rows are dropped", () => {
    const rows = [native, bridged, { ...native, token: native.token.toLowerCase() }, row("base", "0xabc", 50)];
    expect(counted(rows).map((r) => r.chain)).toEqual(["arbitrum", "base"]);
    expect(sumCirculating(counted(rows))).toBe(150);
    const out = buildSupply(findAsset("USDC")!, { supply: rows, unread: [] }, now);
    expect(out.total_supply).toBe(150);
    expect(buildAnswer(findAsset("USDC")!, { supply: rows, unread: [] }, now, null).live_comparison.supply).toBe(150);
  });

  it("counts the same address on two chains twice, because those are separate mints", () => {
    expect(counted([row("base", "0xabc", 1), row("ethereum", "0xabc", 1)])).toHaveLength(2);
  });

  it("lists no bridged token as a native issuer token", () => {
    for (const i of ISSUERS) for (const t of i.tokens) expect(BRIDGED.has(t.token.toLowerCase())).toBe(false);
  });

  it("leaves USDC.e as its own asset", () => {
    expect(findAsset("USDC.e")?.kind).toBe("feed");
  });

  it("keeps cross-chain precision a float sum would lose", () => {
    const rows = [row("a", "0x1", 47_767_081_024.063971), row("b", "0x2", 0.000001)];
    expect(sumCirculating(rows)).toBe(47_767_081_024.063972);
  });
});

describe("issuer treasury", () => {
  it("subtracts known wallets from circulating supply", () => {
    const rows = [row("ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 100, 30)];
    const out = buildSupply(findAsset("USDT")!, { supply: rows, unread: [] }, now);
    expect(out).toMatchObject({ total_supply: 100, treasury_balance: 30, circulating_supply: 70 });
    expect(buildAnswer(findAsset("USDT")!, { supply: rows, unread: [] }, now, null).live_comparison.supply).toBe(70);
  });
  it("configures the USDT treasury wallets", () => {
    const usdt = ISSUERS.find((i) => i.asset === "USDT")!;
    expect(usdt.tokens.filter((t) => t.treasury?.length).map((t) => t.chain).sort()).toEqual(["ethereum", "tron"]);
  });
});
