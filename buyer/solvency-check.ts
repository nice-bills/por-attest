// OUR OWN buyer app: built and run by the por-attest team to exercise the miner end to end.
// Calls made by this script are not independent adoption and must never be presented as such.
//
// Before accepting a token it buys a reserve verdict through Telegraph's ranked routing, then
// accepts or refuses. Settles in test USDC on Ethereum Sepolia (testnet).
//
// Usage: BUYER_PRIVATE_KEY=0x... npm run buyer -- USDC WBTC
//        npm run buyer -- --dry-run USDC     (no key, no payment: records the 402 challenge)
import { mkdirSync, writeFileSync } from "node:fs";
import { decide } from "./decide";
import { MINER_ID, askRouted, type Reply } from "./telegraph";

const LABEL = "por-attest solvency-check: our own app, labelled as ours; not independent adoption. Testnet (Ethereum Sepolia).";
const MINER = process.env.POR_ATTEST_URL ?? "https://por-attest.alnicewilliams3.workers.dev";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const assets = args.filter((a: string) => !a.startsWith("--"));
if (assets.length === 0) throw new Error("Usage: npm run buyer -- [--dry-run] <asset> [asset...]");

const decoded = (value?: string) => (value ? JSON.parse(Buffer.from(value, "base64").toString()) : null);

function save(asset: string, record: object) {
  mkdirSync("evidence", { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const file = `evidence/${dryRun ? "dry-run" : "receipt"}-${asset}-${stamp}.json`;
  writeFileSync(file, `${JSON.stringify({ label: LABEL, ...record }, null, 2)}\n`);
  return file;
}

async function supplyOf(asset: string) {
  const res = await fetch(`${MINER}/supply?asset=${encodeURIComponent(asset)}`);
  return res.ok ? ((await res.json()) as { circulating_supply: number | null; complete: boolean }) : undefined;
}

async function paidCheck(asset: string) {
  const reply: Reply = await askRouted(asset);
  if (reply.status !== 200) {
    console.log(`${asset}: REFUSE, Telegraph answered ${reply.status}`);
    return save(asset, { asset, status: reply.status, body: reply.body, decision: { accept: false, why: `HTTP ${reply.status}` } });
  }
  const receipt = decoded(reply.headers["x-telegraph-receipt"]);
  const decision = decide(reply.body.result, await supplyOf(asset));
  console.log(`${asset}: ${decision.accept ? "ACCEPT" : "REFUSE"}, ${decision.why}`);
  return save(asset, {
    asset,
    date_utc: new Date().toISOString().slice(0, 10),
    routed_to_miner: reply.body.miner_id,
    por_attest_was_paid: String(receipt?.miner) === MINER_ID,
    signal_hash: reply.body.signal_hash,
    cost_usd: reply.body.cost_usd,
    receipt,
    payment_response: reply.headers["payment-response"] ?? null,
    result_shape: reply.body.result_shape,
    result: reply.body.result,
    decision,
  });
}

async function dryCheck(asset: string) {
  const reply = await askRouted(asset, fetch);
  const challenge = decoded(reply.headers["payment-required"]);
  console.log(`${asset}: dry run, Telegraph answered ${reply.status}; nothing was paid`);
  return save(asset, { asset, note: "Unpaid request. This is a payment challenge, not a receipt.", status: reply.status, challenge });
}

console.log(LABEL);
for (const asset of assets) console.log("saved", await (dryRun ? dryCheck(asset) : paidCheck(asset)));
