import { describe, expect, it } from "vitest";
import { FEEDS, ISSUERS, findAsset, findInQuestion } from "../src/catalog";

describe("catalog", () => {
  it("keeps all 74 feeds and 6 issuers", () => {
    expect(FEEDS).toHaveLength(74);
    expect(ISSUERS.map((i) => i.asset).sort()).toEqual(["PAXG", "PYUSD", "USDC", "USDT", "USDe", "XAUT"]);
  });
  it("gives every feed a unique key", () => {
    expect(new Set(FEEDS.map((f) => f.key)).size).toBe(74);
  });
  it("matches symbols case-insensitively and prefers issuer data", () => {
    expect(findAsset("usde")?.kind).toBe("issuer");
    expect(findAsset("cbbtc")?.asset).toBe("cbBTC");
    expect(findAsset("USDC")?.kind).toBe("issuer");
  });
  it("honours a chain hint", () => {
    const asset = findAsset("USDC.e", "avalanche");
    expect(asset?.kind === "feed" && asset.chain).toBe("avalanche");
  });
  it("reads assets out of questions", () => {
    expect(findInQuestion("Is USDC fully backed right now?").asset?.asset).toBe("USDC");
    expect(findInQuestion("Is Tether fully backed?").asset?.asset).toBe("USDT");
  });
  it("reports an unlisted symbol instead of guessing", () => {
    expect(findInQuestion("Is FAKECOIN fully backed?")).toEqual({ unknown: "FAKECOIN" });
  });
  it("finds nothing in a question with no asset", () => {
    expect(findInQuestion("is it safe?")).toEqual({ unknown: undefined });
  });
});
