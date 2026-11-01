// Usage: npm run fixtures -- --mission exchange --target <url|telegraph>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildAnswer } from "../src/answer";
import { findAsset } from "../src/catalog";
import { buildTransfer } from "../src/transfer";
import { askTelegraphDirect } from "../buyer/telegraph";

interface Fixture {
  mission: string;
  example_build: string;
  intent: string;
  mode: "pinned" | "live" | "simulated";
  input: Record<string, any>;
  expected: Record<string, any>;
}

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const mission = flag("mission");
const target = flag("target") ?? "https://por-attest.alnicewilliams3.workers.dev";

const at = (obj: any, path: string) => path.split(".").reduce((o, k) => o?.[k], obj);
const close = (a: number, b: number, tolerance = 1e-9) => Math.abs(a - b) <= Math.abs(b) * tolerance;

const RULES: Record<string, (body: any, ms: number) => string | null> = {
  under_5s: (_b, ms) => (ms < 5000 ? null : `took ${ms} ms`),
  ratio_matches: (b) => {
    const { reserves, supply, ratio } = b.headline ?? {};
    if (ratio != null && !close(ratio, reserves / supply)) return "headline ratio != reserves / supply";
    const live = b.live_comparison;
    if (live?.ratio != null && !close(live.ratio, reserves / live.supply)) return "live ratio != reserves / supply";
    return null;
  },
  provenance: (b) => {
    if (!b.headline?.source || !b.headline?.as_of) return "headline has no source or date";
    if (b.source_type === "chainlink_por" && !b.chainlink?.round_id) return "no round id";
    if (b.source_type === "issuer_attestation" && !b.report?.report_url) return "no report url";
    for (const c of b.live_comparison?.chains ?? []) if (!c.chain || !c.block_number || !c.block_timestamp) return "supply row without provenance";
    return null;
  },
  verdict_consistent: (b) => {
    if (b.stale && b.verdict !== "unverified") return "stale but not unverified";
    const ratio = b.headline?.ratio ?? b.live_comparison?.ratio;
    if (b.verdict === "fully_backed" && !(ratio >= 0.999)) return `fully_backed at ratio ${ratio}`;
    if (b.verdict === "under_backed" && !(ratio < 1)) return `under_backed at ratio ${ratio}`;
    if (b.verdict === "unverified" && !b.reason) return "unverified without a reason";
    return null;
  },
  supply_provenance: (b) => {
    if (!b.chains?.length) return "no chains read";
    for (const c of b.chains) if (!c.chain || !c.block_number || !c.block_timestamp) return `${c.chain} lacks provenance`;
    return null;
  },
};

async function call(f: Fixture): Promise<{ status: number; body: any; ms: number }> {
  const started = Date.now();
  if (f.mode === "simulated" && f.input.raw) {
    const { chain, tx_hash, raw, now } = f.input;
    return { status: 200, body: buildTransfer(chain, tx_hash, raw, [], new Date(now)), ms: 0 };
  }
  if (f.mode === "simulated") {
    const { asset, read, now } = f.input;
    return { status: 200, body: buildAnswer(findAsset(asset)!, read, new Date(now), null), ms: 0 };
  }
  const { path, ...params } = f.input;
  if (target === "telegraph") {
    const reply = await askTelegraphDirect(path, params);
    return { status: reply.status, body: reply.body?.result ?? reply.body, ms: Date.now() - started };
  }
  const url = `${target}${path}?${new URLSearchParams(params)}`;
  // One retry: a dropped connection here says nothing about the Worker.
  const res = await fetch(url).catch(() => fetch(url));
  return { status: res.status, body: await res.json(), ms: Date.now() - started };
}

function check(f: Fixture, r: { status: number; body: any; ms: number }): string[] {
  // `status` is the HTTP code; status_field checks the body's own status.
  const { rules, status, status_field, ...exact } = f.expected;
  const problems: string[] = [];
  if (r.status !== (status ?? 200)) problems.push(`status ${r.status}, wanted ${status ?? 200}`);
  if (status_field && r.body.status !== status_field) problems.push(`status field: got ${r.body.status}, wanted ${status_field}`);
  for (const [path, want] of Object.entries(exact)) {
    const got = at(r.body, path);
    if (got !== want && !(typeof want === "number" && typeof got === "number" && close(got, want))) problems.push(`${path}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  }
  for (const rule of rules ?? []) {
    const problem = RULES[rule](r.body, r.ms);
    if (problem) problems.push(`${rule}: ${problem}`);
  }
  return problems;
}

const missions = readdirSync("fixtures", { withFileTypes: true }).filter((d) => d.isDirectory() && (!mission || d.name === mission)).map((d) => d.name);
if (missions.length === 0) throw new Error(`no fixtures for mission ${mission}`);

const lines = [`# Fixture report`, ``, `Target: ${target}`, `Run: ${new Date().toISOString()}`, ``, `| Mission | Case | Mode | Result | Detail |`, `| --- | --- | --- | --- | --- |`];
let failed = 0;
for (const name of missions) {
  for (const file of readdirSync(`fixtures/${name}`).sort()) {
    const f: Fixture = JSON.parse(readFileSync(`fixtures/${name}/${file}`, "utf8"));
    const problems = await call(f).then((r) => check(f, r), (err) => [`request failed: ${err.message}`]);
    const ok = problems.length === 0;
    if (!ok) failed++;
    const label = file.replace(".json", "");
    console.log(`${ok ? "pass" : "FAIL"}  ${name}/${label}${ok ? "" : `  ${problems.join("; ")}`}`);
    lines.push(`| ${name} | ${label} | ${f.mode} | ${ok ? "pass" : "FAIL"} | ${problems.join("; ").replaceAll("|", "\\|")} |`);
  }
}
lines.push(``, `${failed} failed.`, ``);
writeFileSync("fixtures/report.md", lines.join("\n"));
process.exit(failed ? 1 : 0);
