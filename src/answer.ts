import { formatUnits } from "viem";
import { REPORTS, type Asset, type FeedAsset, type IssuerAsset, type Report } from "./catalog";
import { counted, sumCirculating, type AssetRead } from "./reads";

export type Verdict = "fully_backed" | "under_backed" | "unverified";

const DAY_MS = 86_400_000;
// A feed and a supply read are taken at different times; rebasing tokens drift between them.
const FEED_TOLERANCE = 0.001;

export function latestReport(asset: string): Report | undefined {
  const reports = REPORTS[asset] ?? [];
  return reports[reports.length - 1];
}

function liveComparison(read: AssetRead, reserves: number | null) {
  const chains = counted(read.supply);
  const supply = sumCirculating(chains);
  const complete = read.unread.length === 0 && chains.length > 0;
  return {
    supply: chains.length ? supply : null,
    ratio: reserves !== null && supply > 0 ? reserves / supply : null,
    complete,
    chains,
    unread: read.unread,
  };
}

const verdictFor = (ratio: number, tolerance = 0): Verdict => (ratio >= 1 - tolerance ? "fully_backed" : "under_backed");
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
  else verdict = verdictFor(live.ratio, FEED_TOLERANCE);

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
    verdict_type: "reserve_backing",
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
  const live = liveComparison(read, report.reserves);
  const reportRatio = report.supply_reported ? report.reserves / report.supply_reported : null;
  // USDe is a hedged synthetic dollar with no report supply: its check is collateral vs live supply.
  const coverage = asset.verdict_type === "collateral_coverage";
  const ratio = coverage ? live.ratio : reportRatio;

  let verdict: Verdict = "unverified";
  let why = "";
  if (stale) why = `the report is ${ageDays} days old, past the ${report.stale_after_days} day limit`;
  else if (ratio === null) why = coverage ? "live supply could not be read" : "the report gives no supply figure";
  else if (coverage && !live.complete) why = "supply could not be read on every chain";
  else verdict = verdictFor(ratio);

  const source = `${report.attestor ?? asset.issuer} ${report.kind === "independent_attestation" ? "report" : "disclosure"} for ${asset.issuer}`;
  const ratioText = ratio !== null ? `ratio ${ratio.toFixed(4)} ` : "";
  const label = coverage ? (verdict === "fully_backed" ? "fully collateralised" : words(verdict)) : words(verdict);
  return {
    intent: "ASSET_RESERVE_ATTESTATION_GENERAL",
    source_type: "issuer_attestation",
    asset: asset.asset,
    question,
    verdict,
    verdict_type: asset.verdict_type ?? "reserve_backing",
    fully_backed: fullyBacked(verdict),
    confidence: verdict === "unverified" ? 0 : report.kind === "independent_attestation" ? 0.8 : 0.6,
    summary: `${asset.asset} is ${label}${why ? ` because ${why}` : ""}: ${ratioText}as of ${report.report_date}, from the ${source}.`,
    reason: coverage
      ? `Collateral from the issuer's disclosure dated ${report.report_date} (${report.report_url}), compared with supply read on-chain. This is not a stablecoin reserve attestation.${why ? ` Unverified because ${why}.` : ""}`
      : `Reserves and supply are both from the report dated ${report.report_date} (${report.report_url}). live_comparison is our own on-chain read and does not change the headline.${why ? ` Unverified because ${why}.` : ""}`,
    stale,
    headline: {
      reserves: report.reserves,
      supply: report.supply_reported,
      ratio: reportRatio,
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
