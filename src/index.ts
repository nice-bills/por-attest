import { Hono } from "hono";
import { buildAnswer } from "./answer";
import { FEEDS, ISSUERS, findAsset, findInQuestion, type Asset } from "./catalog";
import miner from "../miner.yaml";
import home from "./pages/home.html";
import privacy from "./pages/privacy.html";
import terms from "./pages/terms.html";
import { readAssets } from "./reads";
import { buildSupply } from "./supply";

export interface Env {
  POR_KV: KVNamespace;
}

export const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.html(home));
app.get("/terms", (c) => c.html(terms));
app.get("/privacy", (c) => c.html(privacy));

app.get("/miner.yaml", (c) => c.text(miner, 200, { "content-type": "text/yaml; charset=utf-8" }));

app.get("/health", (c) =>
  c.json({ status: "ok", feeds: FEEDS.length, issuers: ISSUERS.length, time: new Date().toISOString() }),
);

app.get("/assets", (c) =>
  c.json({
    count: FEEDS.length,
    assets: FEEDS.map(({ asset, name, chain, feed, heartbeat_seconds, comparable, tokens }) => ({
      asset, name, chain, feed, heartbeat_seconds, supply_mapped: tokens.length > 0, comparable, source_type: "chainlink_por",
    })),
    issuer_attested: ISSUERS.map(({ asset, name, issuer, unit, cadence, transparency_page, tokens }) => ({
      asset, name, issuer, unit, cadence, source_type: "issuer_attestation", transparency_page,
      supply_chains: tokens.map((t) => t.chain),
    })),
  }),
);

export function resolveAsset(query: { asset?: string; chain?: string; question?: string }): { asset: Asset } | { error: { code: string; message: string }; status: 400 | 404; name?: string } {
  if (query.asset) {
    const asset = findAsset(query.asset, query.chain);
    if (asset) return { asset };
    return { status: 404, name: query.asset, error: { code: "NO_POR_FEED", message: `No Chainlink Proof of Reserve feed or issuer attestation source is listed for "${query.asset}". See GET /assets.` } };
  }
  const found = query.question ? findInQuestion(query.question) : {};
  if (found.asset) return { asset: found.asset };
  if (found.unknown) return resolveAsset({ asset: found.unknown });
  return { status: 400, error: { code: "ASSET_REQUIRED", message: "Name an asset (?asset=WBTC) or pass the full question (?question=...). See GET /assets for supported assets." } };
}

app.get("/reserve", async (c) => {
  const { asset, chain, question } = c.req.query();
  const resolved = resolveAsset({ asset, chain, question });
  if ("error" in resolved) return c.json({ error: resolved.error, asset: resolved.name, verdict: "unverified" }, resolved.status);
  const reads = await readAssets([resolved.asset]);
  return c.json(buildAnswer(resolved.asset, reads[resolved.asset.key], new Date(), question ?? null));
});

app.get("/supply", async (c) => {
  const { asset, chain } = c.req.query();
  const resolved = resolveAsset({ asset, chain });
  if ("error" in resolved) return c.json({ error: resolved.error, asset: resolved.name, verdict: "unverified" }, resolved.status);
  const reads = await readAssets([resolved.asset]);
  return c.json(buildSupply(resolved.asset, reads[resolved.asset.key], new Date(), chain));
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "See GET /assets." } }, 404));

export default app;
