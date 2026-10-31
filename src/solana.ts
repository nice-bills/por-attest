import type { AssetRead, SupplyRead } from "./reads";
import { rpc } from "./rpc";

const PUBLIC_RPC = "https://solana-rpc.publicnode.com";

export interface SolanaJob {
  mint: string;
  read: AssetRead;
}

async function tokenSupply(urls: string[], mint: string) {
  let last: unknown;
  for (const url of urls) {
    try {
      return await rpc(url, "getTokenSupply", [mint, { commitment: "finalized" }]);
    } catch (err) {
      console.error("solana rpc failed", url === PUBLIC_RPC ? "public" : "keyed", String(err).slice(0, 100).replaceAll(url, "<url>"));
      last = err;
    }
  }
  throw last;
}

// The URL carries the provider key, so it comes from a Worker secret and never reaches an answer.
export async function readSolana(jobs: SolanaJob[], secretUrl: string | undefined) {
  const urls = [secretUrl, PUBLIC_RPC].filter((u): u is string => Boolean(u));
  await Promise.all(
    jobs.map(async ({ mint, read }) => {
      try {
        const { context, value } = await tokenSupply(urls, mint);
        const total = Number(value.uiAmountString);
        const row: SupplyRead = {
          chain: "solana",
          token: mint,
          decimals: value.decimals,
          total_supply: total,
          treasury_balance: 0,
          circulating: total,
          // Solana slot. shortcut: timestamp is read time, not block time, to save a subrequest per mint.
          block_number: context.slot,
          block_timestamp: new Date().toISOString(),
        };
        read.supply.push(row);
      } catch {
        read.unread.push({ chain: "solana", reason: "getTokenSupply failed" });
      }
    }),
  );
}
