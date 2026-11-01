import { Hono } from "hono";
import { buildAnswer } from "./answer";
import { FEEDS, ISSUERS, REPORTS, findAsset, findInQuestion, type Asset } from "./catalog";
import miner from "../miner.yaml";
import home from "./pages/home.html";
import privacy from "./pages/privacy.html";
import terms from "./pages/terms.html";
import { readRound } from "./reads";
import { loadSnapshot, needsRefresh, readFor, refreshSnapshot, type Snapshot } from "./snapshot";
import { buildSupply } from "./supply";

export interface Env {
  POR_KV: KVNamespace;
  SOLANA_RPC_URL?: string;
}

export const app = new Hono<{ Bindings: Env }>();

// Stale-while-revalidate: answer from what we have, refresh behind the response.
async function snapshotFor(c: { env: Env; executionCtx: { waitUntil(p: Promise<unknown>): void } }): Promise<Snapshot | null> {
  const snapshot = await loadSnapshot(c.env);
  if (needsRefresh(snapshot, new Date())) c.executionCtx.waitUntil(refreshSnapshot(c.env).catch(console.error));
  return snapshot;
}

app.get("/", (c) => c.html(home));
app.get("/terms", (c) => c.html(terms));
app.get("/privacy", (c) => c.html(privacy));

app.get("/miner.yaml", (c) => c.text(miner, 200, { "content-type": "text/yaml; charset=utf-8" }));

app.get("/health", async (c) => {
  const snapshot = await loadSnapshot(c.env);
  return c.json({ status: "ok", feeds: FEEDS.length, issuers: ISSUERS.length, snapshot_at: snapshot?.generated_at ?? null, time: new Date().toISOString() });
});

// One compact row per asset for the demo page, so it needs one request rather than 80.
app.get("/register", async (c) => {
  const snapshot = await snapshotFor(c);
  const now = new Date();
  const summarise = (asset: Asset) => buildAnswer(asset, readFor(snapshot, asset), now, null, { snapshot_at: snapshot?.generated_at ?? null, report: snapshot?.reports[asset.key] });
  return c.json({
    issuers: ISSUERS.map((asset) => {
      const a = summarise(asset) as ReturnType<typeof summarise> & { report: { age_days: number; report_date: string } };
      return { asset: asset.asset, source: a.report.report_date, ratio: a.headline.ratio ?? a.live_comparison.ratio, age: `${a.report.age_days} d`, verdict: a.verdict };
    }),
    feeds: FEEDS.filter((f) => f.comparable).map((asset) => {
      const a = summarise(asset) as ReturnType<typeof summarise> & { chainlink?: { age_seconds: number } | null };
      return { asset: asset.asset, chain: asset.chain, source: asset.chain, ratio: a.live_comparison.ratio, age: a.chainlink ? `${Math.round(a.chainlink.age_seconds / 3600)} h` : "—", verdict: a.verdict };
    }),
    uncompared: FEEDS.filter((f) => !f.comparable).map((f) => f.asset),
  });
});

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
  const { asset, chain, question, round_id, report_date } = c.req.query();
  const resolved = resolveAsset({ asset, chain, question });
  if ("error" in resolved) return c.json({ error: resolved.error, asset: resolved.name, verdict: "unverified" }, resolved.status);
  if (round_id && resolved.asset.kind === "feed") {
    if (!/^\d+$/.test(round_id)) return c.json({ error: { code: "BAD_ROUND_ID", message: "round_id must be a decimal integer." } }, 400);
    const read = await readRound(resolved.asset, round_id);
    return c.json({ ...buildAnswer(resolved.asset, read, new Date(), question ?? null), pinned: true });
  }
  if (report_date) {
    const report = REPORTS[resolved.asset.key]?.find((r) => r.report_date === report_date);
    if (!report) return c.json({ error: { code: "NO_REPORT", message: `No report dated ${report_date} is held for ${resolved.asset.asset}.` } }, 404);
    // Judged as of its own date, so this answer never drifts.
    const answer = buildAnswer(resolved.asset, { supply: [], unread: [] }, new Date(report_date), question ?? null, { snapshot_at: null, report });
    return c.json({ ...answer, pinned: true });
  }
  const snapshot = await snapshotFor(c);
  const freshness = { snapshot_at: snapshot?.generated_at ?? null, report: snapshot?.reports[resolved.asset.key] };
  return c.json(buildAnswer(resolved.asset, readFor(snapshot, resolved.asset), new Date(), question ?? null, freshness));
});

app.get("/supply", async (c) => {
  const { asset, chain } = c.req.query();
  const resolved = resolveAsset({ asset, chain });
  if ("error" in resolved) return c.json({ error: resolved.error, asset: resolved.name, verdict: "unverified" }, resolved.status);
  const snapshot = await snapshotFor(c);
  return c.json(buildSupply(resolved.asset, readFor(snapshot, resolved.asset), new Date(), chain, snapshot?.generated_at ?? null));
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "See GET /assets." } }, 404));

// Intent endpoints never 5xx: anything unexpected is an unverified answer with a reason.
app.onError((err, c) => {
  console.error(err);
  return c.json({ verdict: "unverified", confidence: 0, reason: "Internal read failed; no figures are asserted.", summary: "The answer is unverified because an internal read failed." });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refreshSnapshot(env));
  },
};
