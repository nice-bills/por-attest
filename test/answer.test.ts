import { formatUnits } from "viem";
import { describe, expect, it } from "vitest";
import { buildAnswer, latestReport } from "../src/answer";
import { findAsset } from "../src/catalog";
import type { AssetRead } from "../src/reads";

const now = new Date("2026-10-31T12:00:00Z");
const supply = (n: number) => ({ chain: "ethereum", token: "0x1", decimals: 8, total_supply: n, block_number: 1, block_timestamp: now.toISOString() });
const wbtc = findAsset("WBTC")!;
const feedRead = (raw: string, ageSeconds: number, n: number): AssetRead => ({
  feed: { answer_raw: raw, round_id: "36893488147419104267", decimals: 8, updated_at_unix: now.getTime() / 1000 - ageSeconds, block_number: 1, block_timestamp: now.toISOString() },
  supply: [supply(n)],
  unread: [],
});
const issuerRead = (n: number): AssetRead => ({ supply: [supply(n)], unread: [] });

describe("chainlink answers", () => {
  it("backs when reserves cover supply", () => {
    expect(buildAnswer(wbtc, feedRead("10000000000", 60, 99), now, null).verdict).toBe("fully_backed");
  });
  it("flags under-backing", () => {
    const out = buildAnswer(wbtc, feedRead("10000000000", 60, 101), now, null);
    expect(out.verdict).toBe("under_backed");
    expect(out.fully_backed).toBe(false);
  });
  it("refuses a stale feed with a reason", () => {
    const out = buildAnswer(wbtc, feedRead("10000000000", 999_999, 99), now, null);
    expect(out.verdict).toBe("unverified");
    expect(out.reason).toContain("heartbeat");
    expect(out.fully_backed).toBeNull();
  });
  it("headline equals the round value exactly and keeps raw provenance", () => {
    const raw = "11614464916289";
    const out = buildAnswer(wbtc, feedRead(raw, 60, 99), now, null);
    expect(out.headline.reserves).toBe(Number(formatUnits(BigInt(raw), 8)));
    expect(out.chainlink).toMatchObject({ answer_raw: raw, decimals: 8, round_id: "36893488147419104267" });
    expect(out.chainlink?.updated_at).toBe(new Date(now.getTime() - 60_000).toISOString());
  });
  it("does not let live supply change the headline", () => {
    const a = buildAnswer(wbtc, feedRead("10000000000", 60, 99), now, null);
    const b = buildAnswer(wbtc, feedRead("10000000000", 60, 500), now, null);
    expect(a.headline).toEqual(b.headline);
    expect(a.live_comparison.ratio).not.toBe(b.live_comparison.ratio);
  });
  it("answers unverified when the feed is unreadable", () => {
    const out = buildAnswer(wbtc, { supply: [], unread: [{ chain: "ethereum", reason: "x" }] }, now, null);
    expect(out.verdict).toBe("unverified");
    expect(out.headline.reserves).toBeNull();
  });
});

describe("issuer answers", () => {
  const usdc = findAsset("USDC")!;
  const report = latestReport("USDC")!;
  it("headline equals the report figures exactly", () => {
    const out = buildAnswer(usdc, issuerRead(1), now, null);
    expect(out.headline).toMatchObject({ reserves: report.reserves, supply: report.supply_reported, as_of: report.report_date });
    expect(out.headline.ratio).toBe(report.reserves / report.supply_reported!);
  });
  it("live supply never changes the headline or the verdict", () => {
    const a = buildAnswer(usdc, issuerRead(1e6), now, null);
    const b = buildAnswer(usdc, issuerRead(1e12), now, null);
    expect(a.headline).toEqual(b.headline);
    expect(a.verdict).toBe(b.verdict);
    expect(a.live_comparison.ratio).not.toBe(b.live_comparison.ratio);
  });
  it("uses numbers with an explicit unit", () => {
    const { headline } = buildAnswer(usdc, issuerRead(1), now, null);
    expect(typeof headline.reserves).toBe("number");
    expect(headline.unit).toBe("USD");
  });
  it("marks a stale report unverified", () => {
    const later = new Date(Date.parse(report.report_date) + 200 * 86_400_000);
    const out = buildAnswer(usdc, issuerRead(1), later, null);
    expect(out.verdict).toBe("unverified");
    expect(out.reason).toContain("day limit");
  });
  it("writes one sentence with verdict, ratio, date and source", () => {
    const { summary } = buildAnswer(usdc, issuerRead(1), now, null);
    expect(summary).toMatch(/fully backed.*ratio 1\.\d{4} as of 2026-09-30, from the /);
    expect(summary.match(/\. /g)).toBeNull();
  });
});
