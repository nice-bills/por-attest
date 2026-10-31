import attestations from "./data/attestations.json";
import feeds from "./data/feeds.json";
import issuers from "./data/issuers.json";

export interface TokenRef {
  chain: string;
  token: string;
  decimals: number;
}

export interface FeedAsset {
  kind: "feed";
  key: string;
  asset: string;
  name: string;
  chain: string;
  feed: string;
  heartbeat_seconds: number;
  comparable: boolean;
  unit: string | null;
  tokens: TokenRef[];
}

export interface Report {
  kind: string;
  attestor: string | null;
  report_date: string;
  cadence: string;
  stale_after_days: number;
  report_url: string;
  page_url: string;
  reserves: number;
  supply_reported: number | null;
}

export interface IssuerAsset {
  kind: "issuer";
  key: string;
  asset: string;
  name: string;
  issuer: string;
  unit: string;
  cadence: string;
  transparency_page: string;
  tokens: TokenRef[];
}

export type Asset = FeedAsset | IssuerAsset;

export const FEEDS: FeedAsset[] = (feeds as Omit<FeedAsset, "kind" | "key">[]).map((f) => ({
  ...f,
  kind: "feed",
  key: `${f.asset}|${f.chain}|${f.feed}`,
}));
export const ISSUERS: IssuerAsset[] = (issuers as Omit<IssuerAsset, "kind" | "key">[]).map((i) => ({
  ...i,
  kind: "issuer",
  key: i.asset,
}));
export const REPORTS = attestations as unknown as Record<string, Report[]>;

const ALIASES: Record<string, string> = {
  TETHER: "USDT",
  CIRCLE: "USDC",
  "TETHER GOLD": "XAUT",
  "PAX GOLD": "PAXG",
  GOLD: "PAXG",
  "PAYPAL USD": "PYUSD",
  LIDO: "STETH",
  "WRAPPED BITCOIN": "WBTC",
  TRUEUSD: "TUSD",
};

// Skipped by findInQuestion when it guesses at a symbol we don't list.
const NOT_SYMBOLS = new Set(["IS", "ARE", "DOES", "DO", "THE", "WHAT", "HOW", "CAN", "PROOF", "RIGHT", "NOW", "RESERVE", "RESERVES"]);

export function findAsset(symbol: string, chain?: string): Asset | undefined {
  const wanted = symbol.trim().toUpperCase();
  const target = ALIASES[wanted] ?? wanted;
  const issuer = ISSUERS.find((i) => i.asset.toUpperCase() === target);
  if (issuer) return issuer;
  const matches = FEEDS.filter((f) => f.asset.toUpperCase() === target);
  const onChain = chain ? matches.filter((f) => f.chain === chain.toLowerCase()) : matches;
  return onChain.find((f) => f.comparable) ?? onChain[0];
}

export function findInQuestion(question: string): { asset?: Asset; unknown?: string } {
  const upper = question.toUpperCase();
  for (const alias of Object.keys(ALIASES).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${alias}\\b`).test(upper)) return { asset: findAsset(alias) };
  }
  const words = question.match(/[A-Za-z][A-Za-z0-9.]*/g) ?? [];
  const symbols = words.map((w) => w.replace(/\.$/, ""));
  for (const word of symbols) {
    const asset = word.length > 1 ? findAsset(word) : undefined;
    if (asset) return { asset };
  }
  const unknown = symbols.find((w) => /^[A-Z0-9.]{3,}$/.test(w) && !NOT_SYMBOLS.has(w));
  return { unknown };
}
