import { describe, expect, it } from "vitest";

const base = process.env.E2E_BASE_URL;
if (!base) throw new Error("Set E2E_BASE_URL");
const get = async (path: string) => {
  const res = await fetch(base + path);
  return { status: res.status, body: (await res.json()) as any };
};

describe("worker", () => {
  it("is healthy", async () => {
    expect((await get("/health")).body.status).toBe("ok");
  });

  it("gives every supply figure a chain, block number and timestamp", async () => {
    const { status, body } = await get("/supply?asset=WBTC");
    expect(status).toBe(200);
    expect(body.chains.length).toBeGreaterThan(0);
    for (const c of body.chains) {
      expect(c.chain).toBeTruthy();
      expect(c.block_number).toBeGreaterThan(0);
      expect(Date.parse(c.block_timestamp)).toBeGreaterThan(0);
      expect(typeof c.total_supply).toBe("number");
    }
  });

  it("filters /supply to one chain", async () => {
    const { body } = await get("/supply?asset=USDC&chain=base");
    expect(body.chains.map((c: { chain: string }) => c.chain)).toEqual(["base"]);
  });

  it("refuses an unknown asset cleanly", async () => {
    const { status, body } = await get("/supply?asset=FAKECOIN");
    expect(status).toBe(200);
    expect(body.error.code).toBe("NO_POR_FEED");
  });
});
