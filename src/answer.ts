import { formatUnits } from "viem";
import { REPORTS, type Asset, type FeedAsset, type IssuerAsset, type Report } from "./catalog";
import type { AssetRead } from "./reads";

export type Verdict = "fully_backed" | "under_backed" | "unverified";

const DAY_MS = 86_400_000;

export function latestReport(asset: string): Report | undefined {
  const reports = REPORTS[asset] ?? [];
  return reports[reports.length - 1];
}

function liveComparison(read: AssetRead, reserves: number | null) {
  const supply = read.supply.reduce((sum, s) => sum + s.total_supply, 0);
  const complete = read.unread.length === 0 && read.supply.length > 0;
  return {
    supply: read.supply.length ? supply : null,
    ratio: reserves !== null && supply > 0 ? reserves / supply : null,
    complete,
    chains: read.supply,
    unread: read.unread,
  };
}

const verdictFor = (ratio: number): Verdict => (ratio >= 1 ? "fully_backed" : "under_backed");
const fullyBacked = (verdict: Verdict) => (verdict === "unverified" ? null : verdict === "fully_backed");
const words = (verdict: Verdict) => verdict.replace("_", " ");

function feedAnswer(asset: FeedAsset, read: AssetRead, now: Date, question: string | null) {
  const feed = read.feed;
  const reserves = feed ? Number(formatUnits(BigInt(feed.answer_raw), feed.decimals)) : null;
  const ageSeconds = feed ? Math.round(now.getTime() / 1000 - feed.updated_at_unix) : null;
  const stale = ageSeconds === null || ageSeconds > asset.heartbeat_seconds;
  const live = liveComparison(read, reserves);
  const updatedAt = feed ? new Date(feed.updated_at_unix * 1000).toISOString() : null;

  let verdict: Verdict = "unverified";
  let why = "";
  if (!feed) why = "the feed could not be read";
  else if (stale) why = `the feed last updated ${ageSeconds}s ago, past its ${asset.heartbeat_seconds}s heartbeat`;
  else if (!asset.comparable) why = "the feed's reserves are not comparable with an on-chain token supply";
  else if (!live.complete || live.ratio === null) why = "supply could not be read on every chain";
  else verdict = verdictFor(live.ratio);

  const source = `Chainlink Proof of Reserve feed ${asset.feed} on ${asset.chain}`;
  const ratioText = live.ratio !== null && verdict !== "unverified" ? `ratio ${live.ratio.toFixed(4)} ` : "";
  const reason = feed
    ? `Reserves: latestRoundData answer ${feed.answer_raw} with ${feed.decimals} decimals, round ${feed.round_id}, updated ${updatedAt}. Supply: token totalSupply read on-chain.${why ? ` Unverified because ${why}.` : ""}`
    : `Unverified because ${why}.`;
  return {
    intent: "ASSET_RESERVE_ATTESTATION_GENERAL",
    source_type: "chainlink_por",
    asset: asset.asset,
    question,
    verdict,
    fully_backed: fullyBacked(verdict),
    confidence: verdict === "unverified" ? 0 : 0.97,
    summary: `${asset.asset} is ${words(verdict)}${why ? ` because ${why}` : ""}: ${ratioText}as of ${updatedAt ?? now.toISOString()}, from the ${source}.`,
    reason,
    stale,
    headline: {
      reserves,
      supply: null,
      ratio: null,
      unit: asset.unit,
      as_of: updatedAt,
      block: feed?.round_id ?? null,
      source,
    },
    chainlink: feed && {
      answer_raw: feed.answer_raw,
      decimals: feed.decimals,
      round_id: feed.round_id,
      updated_at: updatedAt,
      updated_at_unix: feed.updated_at_unix,
      age_seconds: ageSeconds,
      heartbeat_seconds: asset.heartbeat_seconds,
      feed: asset.feed,
      chain: asset.chain,
    },
    live_comparison: live,
    as_of: now.toISOString(),
  };
}

function issuerAnswer(asset: IssuerAsset, report: Report, read: AssetRead, now: Date, question: string | null) {
  const ageDays = Math.floor((now.getTime() - Date.parse(report.report_date)) / DAY_MS);
  const stale = ageDays > report.stale_after_days;
  const ratio = report.supply_reported ? report.reserves / report.supply_reported : null;
  const live = liveComparison(read, report.reserves);

  let verdict: Verdict = "unverified";
  let why = "";
  if (stale) why = `the report is ${ageDays} days old, past the ${report.stale_after_days} day limit`;
  else if (ratio === null) why = "the report gives no supply figure";
  else verdict = verdictFor(ratio);

  const source = `${report.attestor ?? asset.issuer} report for ${asset.issuer}`;
  const ratioText = ratio !== null ? `ratio ${ratio.toFixed(4)} ` : "";
  return {
    intent: "ASSET_RESERVE_ATTESTATION_GENERAL",
    source_type: "issuer_attestation",
    asset: asset.asset,
    question,
    verdict,
    fully_backed: fullyBacked(verdict),
    confidence: verdict === "unverified" ? 0 : report.kind === "independent_attestation" ? 0.8 : 0.6,
    summary: `${asset.asset} is ${words(verdict)}${why ? ` because ${why}` : ""}: ${ratioText}as of ${report.report_date}, from the ${source}.`,
    reason: `Reserves and supply are both from the report dated ${report.report_date} (${report.report_url}). live_comparison is our own on-chain read and does not change the headline.${why ? ` Unverified because ${why}.` : ""}`,
    stale,
    headline: {
      reserves: report.reserves,
      supply: report.supply_reported,
      ratio,
      unit: asset.unit,
      as_of: report.report_date,
      block: report.report_date,
      source,
    },
    report: { ...report, age_days: ageDays },
    live_comparison: live,
    as_of: now.toISOString(),
  };
}

export function buildAnswer(asset: Asset, read: AssetRead, now: Date, question: string | null) {
  if (asset.kind === "feed") return feedAnswer(asset, read, now, question);
  const report = latestReport(asset.asset);
  if (!report) throw new Error(`no report for ${asset.asset}`);
  return issuerAnswer(asset, report, read, now, question);
}
