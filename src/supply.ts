import type { Asset } from "./catalog";
import { counted, sumCirculating, type AssetRead } from "./reads";

export function buildSupply(asset: Asset, read: AssetRead, now: Date, chain?: string, snapshotAt: string | null = null) {
  const wanted = chain?.toLowerCase();
  const chains = counted(read.supply).filter((s) => !wanted || s.chain === wanted);
  const unread = read.unread.filter((u) => !wanted || u.chain === wanted);
  const total = chains.reduce((sum, s) => sum + s.total_supply, 0);
  const treasury = chains.reduce((sum, s) => sum + s.treasury_balance, 0);
  const none = chains.length === 0;
  const scope = none ? "no supply figure could be read" : unread.length ? `partial: unread ${unread.map((u) => u.chain).join(", ")}` : "complete";
  return {
    intent: "TOKEN_TOTAL_SUPPLY_VERIFY_GENERAL",
    asset: asset.asset,
    verdict: none ? "unverified" : "verified",
    confidence: none ? 0 : unread.length ? 0.6 : 0.95,
    reason: `Token totalSupply read on-chain on ${chains.map((s) => `${s.chain} at block ${s.block_number}`).join(", ") || "no chain"}. Scope: ${scope}.`,
    total_supply: none ? null : total,
    treasury_balance: none ? null : treasury,
    circulating_supply: none ? null : sumCirculating(chains),
    unit: asset.asset,
    complete: !none && unread.length === 0,
    chains,
    unread,
    as_of: now.toISOString(),
    snapshot_at: snapshotAt,
  };
}
