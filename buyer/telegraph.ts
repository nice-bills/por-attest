// Calls Telegraph over x402 on Ethereum Sepolia (testnet USDC). Needs BUYER_PRIVATE_KEY.
import { readFileSync } from "node:fs";
import { ExactEvmScheme } from "@x402/evm";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const SEPOLIA = "eip155:11155111";
const TEST_USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17";
const MAX_PAYMENT = "100000"; // $0.10 per call, in 6-decimal test USDC

export const NODE = process.env.TELEGRAPH_NODE ?? "https://devnode.telegraphprotocol.com";
export const MINER_ID = readFileSync("miner.yaml", "utf8").match(/^id: (\d+)/m)?.[1];

export interface Reply {
  status: number;
  body: any;
  headers: Record<string, string>;
}

async function payingFetch(): Promise<typeof fetch> {
  const key = process.env.BUYER_PRIVATE_KEY;
  if (!key) throw new Error("BUYER_PRIVATE_KEY is not set");
  const account = privateKeyToAccount(key as `0x${string}`);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: SEPOLIA, client: new ExactEvmScheme(account) }],
    spendControls: { allowedAssets: [{ network: SEPOLIA, asset: TEST_USDC, maxAmountPerPayment: MAX_PAYMENT }] },
  });
}

async function post(url: string, payload: unknown, pay: typeof fetch): Promise<Reply> {
  const res = await pay(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return { status: res.status, body: await res.json().catch(() => null), headers: Object.fromEntries(res.headers) };
}

export const askRouted = async (asset: string, pay?: typeof fetch) =>
  post(`${NODE}/engine/v1/ask`, { intent: "ASSET_RESERVE_ATTESTATION_GENERAL", params: { asset } }, pay ?? (await payingFetch()));

export const askTelegraphDirect = async (endpoint: string, payload: Record<string, unknown>, pay?: typeof fetch) =>
  post(`${NODE}/engine/v1/ask/${MINER_ID}`, { method: "GET", endpoint, payload }, pay ?? (await payingFetch()));
