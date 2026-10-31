import { formatUnits } from "viem";
import { REPORTS, type Asset } from "./catalog";
import type { AssetRead } from "./reads";

export type Verdict = "fully_backed" | "under_backed" | "unverified";

export function latestReport(asset: string) {
  const reports = REPORTS[asset] ?? [];
  return reports[reports.length - 1];
}

export function buildAnswer(asset: Asset, read: AssetRead, now: Date, question: string | null) {
  const supply = read.supply.reduce((sum, s) => sum + s.total_supply, 0);
  if (asset.kind === "feed") {
    const feed = read.feed;
    const reserves = feed ? Number(formatUnits(BigInt(feed.answer_raw), feed.decimals)) : null;
    const age = feed ? now.getTime() / 1000 - feed.updated_at_unix : Infinity;
    const stale = age > asset.heartbeat_seconds;
    const ratio = reserves !== null && asset.comparable && supply > 0 ? reserves / supply : null;
    const verdict: Verdict = stale || ratio === null ? "unverified" : ratio >= 1 ? "fully_backed" : "under_backed";
    return { intent: "ASSET_RESERVE_ATTESTATION_GENERAL", source_type: "chainlink_por", asset: asset.asset, question, verdict, reserves, reserves_unit: asset.unit, supply, ratio, stale, feed, supply_breakdown: read.supply, as_of: now.toISOString() };
  }
  const report = latestReport(asset.asset);
  const ratio = supply > 0 ? report.reserves / supply : null;
  const age = (now.getTime() - Date.parse(report.report_date)) / 86_400_000;
  const stale = age > report.stale_after_days;
  const verdict: Verdict = stale || ratio === null ? "unverified" : ratio >= 1 ? "fully_backed" : "under_backed";
  return { intent: "ASSET_RESERVE_ATTESTATION_GENERAL", source_type: "issuer_attestation", asset: asset.asset, question, verdict, reserves: report.reserves, reserves_unit: asset.unit, supply, ratio, stale, report, supply_breakdown: read.supply, as_of: now.toISOString() };
}
