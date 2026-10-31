import { latestReport } from "./answer";
import { FEEDS, ISSUERS, type Asset, type Report } from "./catalog";
import type { Env } from "./index";
import { readAssets, type AssetRead, type Reads } from "./reads";

const KEY = "snapshot:v1";
const ISOLATE_CACHE_MS = 15_000;
// Cron runs every 120s; past this it has missed a beat and a request may refresh instead.
const REFRESH_AFTER_MS = 180_000;

export interface Snapshot {
  generated_at: string;
  reads: Reads;
  reports: Record<string, Report>;
}

let cached: { at: number; snapshot: Snapshot } | undefined;
let refreshing = false;

export function resetSnapshotCache() {
  cached = undefined;
  refreshing = false;
}

async function latestUsde(previous?: Report): Promise<Report | undefined> {
  const seed = previous ?? latestReport("USDe");
  try {
    const res = await fetch("https://ethena.fi/api/positions/current/collateral?latest=true", { signal: AbortSignal.timeout(4_000) });
    const body = (await res.json()) as { totalBackingAssetsInUsd?: number };
    if (seed && body.totalBackingAssetsInUsd) {
      return { ...seed, reserves: body.totalBackingAssetsInUsd, report_date: new Date().toISOString().slice(0, 10) };
    }
  } catch (err) {
    console.error("ethena read failed", err);
  }
  return seed;
}

export async function refreshSnapshot(env: Env): Promise<Snapshot> {
  const previous = await loadSnapshot(env);
  const [reads, usde] = await Promise.all([readAssets([...FEEDS, ...ISSUERS], env.SOLANA_RPC_URL), latestUsde(previous?.reports.USDe)]);
  refreshing = false;
  const snapshot: Snapshot = { generated_at: new Date().toISOString(), reads, reports: usde ? { USDe: usde } : {} };
  await env.POR_KV.put(KEY, JSON.stringify(snapshot));
  cached = { at: Date.now(), snapshot };
  return snapshot;
}

export async function loadSnapshot(env: Env): Promise<Snapshot | null> {
  if (cached && Date.now() - cached.at < ISOLATE_CACHE_MS) return cached.snapshot;
  try {
    const snapshot = await env.POR_KV.get<Snapshot>(KEY, "json");
    if (snapshot) cached = { at: Date.now(), snapshot };
    return snapshot;
  } catch (err) {
    console.error("snapshot read failed", err);
    return cached?.snapshot ?? null;
  }
}

export function needsRefresh(snapshot: Snapshot | null, now: Date): boolean {
  if (refreshing) return false;
  const stale = !snapshot || now.getTime() - Date.parse(snapshot.generated_at) > REFRESH_AFTER_MS;
  if (stale) refreshing = true;
  return stale;
}

export function readFor(snapshot: Snapshot | null, asset: Asset): AssetRead {
  return snapshot?.reads[asset.key] ?? { supply: [], unread: [{ chain: "all", reason: "no snapshot available" }] };
}
