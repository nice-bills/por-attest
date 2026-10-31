import { describe, expect, it } from "vitest";
import { buildAnswer } from "../src/answer";
import { findAsset } from "../src/catalog";
import type { AssetRead } from "../src/reads";

const now = new Date("2026-10-31T12:00:00Z");
const supply = (n: number) => ({ chain: "ethereum", token: "0x1", decimals: 8, total_supply: n, block_number: 1, block_timestamp: now.toISOString() });
const wbtc = findAsset("WBTC")!;
const feedRead = (raw: string, ageSeconds: number, n: number): AssetRead => ({
  feed: { answer_raw: raw, round_id: "1", decimals: 8, updated_at_unix: now.getTime() / 1000 - ageSeconds, block_number: 1, block_timestamp: now.toISOString() },
  supply: [supply(n)],
  unread: [],
});

describe("buildAnswer", () => {
  it("backs when reserves cover supply", () => {
    expect(buildAnswer(wbtc, feedRead("10000000000", 60, 99), now, null).verdict).toBe("fully_backed");
  });
  it("flags under-backing", () => {
    expect(buildAnswer(wbtc, feedRead("10000000000", 60, 101), now, null).verdict).toBe("under_backed");
  });
  it("refuses a stale feed", () => {
    expect(buildAnswer(wbtc, feedRead("10000000000", 999_999, 99), now, null).verdict).toBe("unverified");
  });
});
