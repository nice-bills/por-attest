import { describe, expect, it } from "vitest";
import { decide } from "../buyer/decide";

describe("decide", () => {
  it("accepts only a fully_backed verdict", () => {
    expect(decide({ verdict: "fully_backed" }).accept).toBe(true);
    expect(decide({ verdict: "under_backed" }).accept).toBe(false);
    expect(decide({ verdict: "unverified" }).accept).toBe(false);
  });
  it("compares an intent-shaped answer with circulating supply", () => {
    const supply = { circulating_supply: 100, complete: true };
    expect(decide({ attested_reserve: 101_000_000 }, supply).accept).toBe(true);
    expect(decide({ attested_reserve: 99_000_000 }, supply).accept).toBe(false);
  });
  it("refuses when supply is partial", () => {
    expect(decide({ attested_reserve: 101_000_000 }, { circulating_supply: 100, complete: false }).accept).toBe(false);
  });
  it("refuses an empty answer", () => {
    expect(decide({}).accept).toBe(false);
    expect(decide(null).accept).toBe(false);
  });
});
