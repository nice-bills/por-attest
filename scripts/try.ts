// Usage: npm run try -- <asset> [url]
export {};
const [asset, target = "https://por-attest.alnicewilliams3.workers.dev"] = process.argv.slice(2);
if (!asset) throw new Error("Usage: npm run try -- <asset> [url]");
const res = await fetch(`${target}/reserve?asset=${encodeURIComponent(asset)}`);
console.log(res.status, JSON.stringify(await res.json(), null, 2));
