import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { app } from "../src/index";

const raw = readFileSync("miner.yaml", "utf8");
const miner = parse(raw);

// The closed key sets from https://anjoman.ai/docs/miners/yaml-config, for use while the
// hosted validator is unavailable. This does not replace it.
const ROOT = ["version", "kind", "id", "slug", "protocol", "name", "description", "base_url", "input_schema", "output_schema", "intent_mapping", "polling", "cache_ttl_sec", "rate_limit_per_sec", "circuit_threshold", "circuit_cooldown_seconds", "docs", "limitations", "errors", "auth", "endpoints", "semantics", "on_chain"];
const ENDPOINT = ["path", "external_path", "method", "description", "intents", "params", "endpoint_base_url", "content_type", "multipart_fields", "param_map"];

describe("miner.yaml", () => {
  it("has the required root fields and no unknown keys", () => {
    for (const key of ["version", "kind", "id", "slug", "name", "base_url"]) expect(miner[key]).toBeDefined();
    expect(Object.keys(miner).filter((k) => !ROOT.includes(k))).toEqual([]);
    expect(raw).not.toMatch(/TODO/);
  });

  it("describes every endpoint with allowed keys only", () => {
    for (const e of miner.endpoints) {
      expect(e.description).toBeTruthy();
      expect(Object.keys(e).filter((k) => !ENDPOINT.includes(k))).toEqual([]);
    }
  });

  it("lists every endpoint intent in supported_intents", () => {
    const supported = miner.semantics.supported_intents;
    expect(supported).toEqual(["ASSET_RESERVE_ATTESTATION_GENERAL", "TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL", "CRYPTO_TRANSFER_VERIFY_GENERAL"]);
    for (const e of miner.endpoints) for (const i of e.intents ?? []) expect(supported).toContain(i);
  });

  it("uses upper snake limitation codes", () => {
    for (const l of miner.limitations) expect(l.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it("maps intents to declared endpoints", () => {
    const paths = miner.endpoints.map((e: { path: string }) => e.path);
    for (const m of Object.values<{ endpoint: string }>(miner.intent_mapping)) expect(paths).toContain(m.endpoint);
  });

  it("is served at /miner.yaml", async () => {
    const res = await app.request("/miner.yaml");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(raw);
  });
});
