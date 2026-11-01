#!/usr/bin/env python3
"""Builds the silent, captioned demo video from saved real output. Needs chromium and ffmpeg.
Usage: python3 docs/video/build.py <data_dir> <output.mp4>"""
import html, json, pathlib, subprocess, sys, tempfile

data, out = pathlib.Path(sys.argv[1]), sys.argv[2]
wbtc = json.loads((data / "wbtc.json").read_text())
stale = json.loads((data / "stale.json").read_text())
unknown = json.loads((data / "unknown.json").read_text())
fixtures = (data / "fixtures.txt").read_text().strip().splitlines()
receipt = json.loads(sorted(pathlib.Path("evidence").glob("receipt-XAUT-2026-11-01*"))[-1].read_text())
r = receipt["receipt"]

def code(text):
    return f"<pre>{html.escape(text)}</pre>"

headline = json.dumps({k: wbtc[k] for k in ("verdict", "verdict_type", "confidence")} | {"headline": wbtc["headline"]}, indent=2)
chainlink = json.dumps({k: wbtc["chainlink"][k] for k in ("answer_raw", "decimals", "round_id", "updated_at")}, indent=2)
counts = {m: sum(f"  {m}/" in line for line in fixtures) for m in ("stablecoin", "exchange", "asset-management")}
passed = sum(line.startswith("pass") for line in fixtures)

SCENES = [
    (22, "The problem", "<h1>Is this token backed right now?</h1><p>An agent must know that before it accepts a token as payment or collateral.</p><p>por-attest is a Telegraph miner that answers it with sources, dates and a verdict.</p><p class=dim>74 Chainlink Proof of Reserve feeds, plus USDC, USDT, XAUT, PAXG, PYUSD and USDe.</p>"),
    (26, "A request", "<h2>Ask in plain terms</h2>" + code('$ curl "https://por-attest.alnicewilliams3.workers.dev/reserve?asset=WBTC"') + "<h2>One-sentence answer</h2><p>" + html.escape(wbtc["summary"]) + "</p>"),
    (26, "Authoritative figures first", "<h2>The headline is the source's own figure</h2>" + code(headline) + "<p class=dim>Our own live supply read sits in a separate field and cannot change this block.</p>"),
    (22, "Provenance", "<h2>Every figure can be checked</h2>" + code(chainlink) + "<p>Each supply figure in <b>live_comparison</b> carries chain, block number and timestamp.</p>"),
    (26, "A paid call through Telegraph", "<h2>Paid call, Ethereum Sepolia testnet</h2>" + code(f"miner paid:   por-attest (id {receipt['routed_to_miner']})\namount:       {int(r['amount_uusdc'])/1e6} test USDC\nrail:         {r['rail']}, settlement {r['settlement']}\nsignal hash:  {receipt['signal_hash']}\nreceipt:      {r['receipt_hash']}") + "<p>Our buyer app bought the verdict, then accepted the token: " + html.escape(receipt["result"]["summary"]) + "</p><p class=dim>The buyer app is ours, labelled as ours. This call names our miner directly; routed calls have not reached us yet.</p>"),
    (28, "Three missions, one command", f"<h2>Fixtures anyone can rerun</h2>" + code("$ npm run fixtures -- --target https://por-attest.alnicewilliams3.workers.dev") + f"<h1>{passed} of {len(fixtures)} passed</h1><p>Stablecoin: {counts['stablecoin']} cases &nbsp; Exchange: {counts['exchange']} cases &nbsp; Asset Management: {counts['asset-management']} cases</p><p class=dim>Pinned figures from past rounds and reports, plus rules checked live.</p>"),
    (20, "Failure: stale data", "<h2>Stale data is not guessed at</h2>" + code(f"$ curl \".../reserve?asset=stETH&round_id=18446744073709554689\"\nverdict: {stale['verdict']}\nstale:   {str(stale['stale']).lower()}") + "<p>" + html.escape(stale["reason"][stale["reason"].index("Unverified because"):]) + "</p>"),
    (20, "Failure: unknown asset, RPC disagreement", "<h2>Clean refusals</h2>" + code('$ curl ".../reserve?asset=FAKECOIN"\nHTTP 404\n' + json.dumps(unknown["error"], indent=2)) + "<p>If two RPCs disagree by more than 0.5%, the figures are withheld and the verdict is <b>unverified</b>.</p><p class=dim>RPC disagreement and stale reports also run as simulated fixtures on the real answer code.</p>"),
    (28, "Reliability and cost", "<h2>Deployed Worker, 31 Oct 2026</h2>" + code("load test:  2,571 requests, 20 connections, 30 s\nresults:    2,571 2xx, 0 errors\nlatency:    p50 218 ms, p97.5 441 ms, p99 671 ms\nsnapshot:   all assets refreshed every 2 minutes\nuptime:     public history, checked from GitHub Actions\ncost:       $0.01 per call in test USDC (floor price)") + "<p class=dim>Load test run from one home connection. Uptime history started on 1 Nov 2026.</p>"),
    (22, "Limitations and how to try it", "<h2>Limitations</h2><p>Testnet settlement; mainnet data. Fixed asset list. Monthly or quarterly issuer reports. Live supply covers the chains we list, not every chain.</p><h1>Build on our reserve intents: here's the fixture.</h1>" + code("github.com/nice-bills/por-attest\n$ npm run fixtures -- --mission exchange"))
]

CSS = """body{margin:0;width:1920px;height:1080px;background:#0f1412;color:#eef2ee;font:34px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;padding:90px 120px;position:relative}
h1{font-size:64px;line-height:1.2;margin:.3em 0;color:#7fe0a7}h2{font-size:44px;margin:.2em 0 .5em;color:#7fe0a7}p{margin:.5em 0}
pre{background:#1a211e;border-left:6px solid #7fe0a7;padding:24px 32px;font:inherit;font-size:29px;line-height:1.35;white-space:pre-wrap;word-break:break-all;margin:.5em 0}
.dim{color:#a7b3ac;font-size:29px}.tag{position:absolute;left:120px;right:120px;bottom:44px;display:flex;justify-content:space-between;color:#a7b3ac;font-size:24px}"""

with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    lines = []
    for i, (seconds, title, body) in enumerate(SCENES):
        page = tmp / f"{i}.html"
        page.write_text(f"<!doctype html><meta charset=utf-8><style>{CSS}</style><body>{body}<div class=tag><span>{html.escape(title)}</span><span>por-attest · real output, 1 Nov 2026 · testnet payment</span></div>")
        shot = tmp / f"{i}.png"
        subprocess.run(["chromium", "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=1920,1080", f"--user-data-dir={tmp}/profile", f"--screenshot={shot}", f"file://{page}"], check=True, capture_output=True)
        lines += [f"file '{shot}'", f"duration {seconds}"]
    lines.append(f"file '{tmp}/{len(SCENES)-1}.png'")
    (tmp / "list.txt").write_text("\n".join(lines))
    for i in range(len(SCENES)):
        subprocess.run(["cp", tmp / f"{i}.png", pathlib.Path(out).with_name(f"scene-{i}.png")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", tmp / "list.txt", "-t", str(sum(s for s, _, _ in SCENES)), "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", out], check=True)
print("total seconds", sum(s for s, _, _ in SCENES))
