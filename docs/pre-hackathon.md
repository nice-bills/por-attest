# Pre-hackathon code disclosure

por-attest was already running at https://por-attest.alnicewilliams3.workers.dev before 1 Nov 2026.
That Worker's source was not in this repository. Its bundled build was saved outside the repo
before the rewrite replaced it on 31 Oct 2026.

- The `pre-hackathon` tag marks the project brief only. It contains no pre-hackathon source code.
- Everything under `src/` was rewritten after that tag. Its asset, feed and attestation data
  (`src/data/`) was captured on 31 Oct 2026 from the deployed Worker's public `/assets` and
  `/reserve` responses, and the pages in `src/pages/` were copied from it.
- The rewrite therefore carries over pre-hackathon data and behaviour, and that must be disclosed
  at submission alongside the deployed Worker.
