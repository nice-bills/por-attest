import { describe, expect, it } from "vitest";
import { CHAINS, useAlchemy } from "../src/chains";

describe("useAlchemy", () => {
  it("does nothing without a key", () => {
    const before = CHAINS.ethereum.rpcs.length;
    useAlchemy(undefined);
    expect(CHAINS.ethereum.rpcs).toHaveLength(before);
  });
  it("puts the keyed RPC first, keeps the fallbacks, and applies once", () => {
    const before = CHAINS.ethereum.rpcs.length;
    useAlchemy("k");
    useAlchemy("k");
    expect(CHAINS.ethereum.rpcs[0]).toBe("https://eth-mainnet.g.alchemy.com/v2/k");
    expect(CHAINS.ethereum.rpcs).toHaveLength(before + 1);
    expect(CHAINS.tron.rpcs[0]).not.toContain("alchemy");
  });
});
