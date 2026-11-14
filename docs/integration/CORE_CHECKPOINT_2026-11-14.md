# Core acceptance continuation checkpoint

Start from the latest actual main; do not reset the platform or import whole historical branches. Main861aa94 includes externally merged PR412 and PR413. Their merges were not performed by this agent. The additional exact-task work is isolated on `codex/eylo-exact-task-acceptance` and must stay draft until the relevant hosted release gates pass.

## Implemented in this continuation

1. Canonical active Notes/tasks are first-class Knowledge Graph nodes with exact editor links and only explicit saved project associations. Five collections use the expected-owner repository check, raw PostgreSQL owner verification, bounded reads and transparent partial/cap reporting. The canvas balances120 nodes across record types. Account changes discard prior nodes before delayed results arrive.
2. Known EYLO gateway503/shared429 errors are differentiated from upstream provider failures. Error bodies are restricted to8KiB/two seconds and allowlisted status/code pairs; raw messages never enter product copy. Hosted errors never trigger direct-provider fallback. Existing provider error contracts remain intact. A real root-production-bundle browser regression covers total outage, partial results and quota exhaustion.
3. Project Intelligence displays deterministic saved workplan, experiment/publication and budget signals, separately from EYRA interpretation. It excludes unsaved edits, never mutates the project, preserves its source version, links the canonical source workspaces and reports invalid modules rather than fabricating zeros. It does not verify scientific success, publication decisions or accounting records.
4. A pinned28-file migration manifest now drives the actual21-file local SQL replay and a read-only review command. Seven legacy/side-effect migrations are excluded explicitly, including a cron targeting live EYLO. Shared legacy version20260803/nonstandard timestamps require hosted history reconciliation. Changed/new SQL or a scheduler added to local replay fails the guard. No remote SQL is executed or authorized by this tool.

5. Life exact task links retrieve authorized records beyond the recent1000 cap, handle same-route query changes, reject foreign/missing IDs without a substitute task and recover normal creation after refusal. Expected-owner checks inspect the raw row before flattening.

## Current evidence

See [batch12 exact commands/categories](batch-12-core-acceptance.json) and [all77 matrix](product-matrix.json). Scoped local tests are not per-product completion. The current count remains77 partial implementations, zero fully accepted products.

- 727 tests/imports/typecheck/lint/production build pass.
- Five local browser suites pass (Auth, canonical learning, all22 bounded product scopes, public Pages/theme, production gateway attribution). HTTP/Auth/Storage/AI transport is fixture-based; the network-off production shell test actually disables network.
- 21 selected migrations execute on actual disposable PostgreSQL, including roles, concurrent CAS/quota/snapshot behavior and deletion lifecycle checks. No hosted migration ran.
- Two fresh local-handler diagnostics use real public providers and pass5/5 unchanged source/anchor gates, mean0.94. Semantic Scholar429 is disclosed; no human relevance sign-off exists.
- Hosted five-query proxy diagnostic fails0/5 with503 `DISCOVERY_RATE_LIMIT_UNAVAILABLE`. Classified live responses confirm a gateway quota failure, not a finding that scientific providers are down.
- Public browser/server source manifests match main3854e98. Public day/night/plans were observed read-only; AI/contact/billing and other optional capabilities remain false.
- Both production/full dependency audits report zero known advisories. This is not proof of zero security defects.

## Blocking dependencies and next actions

1. Connect the intended EYLO organization/team and independently verify a separate synthetic-data staging database and Preview deployment. Do not use live `kbzjngpzxpniaumlupaa` or unrelated connected `umzrggayitzfgrrofjnw`. The currently visible Vercel team lists no linked projects.
2. Diagnose the quota service on that verified staging: matching private Supabase server configuration, existing canonical quota RPC/ACL and trusted Vercel IP metadata. See [owner runbook](../release/MARKET_READINESS_RUNBOOK.md). Do not disable the limiter or grant its service-only RPC to browser roles.
3. Execute hosted registration/login/recovery, two-account CRUD/RLS/Storage/versioning, EYRA/OpenAI, file bytes, Stripe sandbox, LiveKit media and privacy/deletion acceptance for the exact candidate. Keep the real-service reports separate from fixtures and local SQL. Human relevance/legal/operational/pilot gates remain required.
4. Continue unimplemented advanced contracts from each matrix row: durable cancellable agent runs/outcome audit, Smart Import preview/mapping/rollback, append-only evidence/contradictory-source workflow, thesis source-version pinning, richer collaboration and Offline writes/sync. These are not completed by current generic workbenches or this batch.
5. Re-run only checks justified by new changes, commit verified batches, update the matrix and compare changed PR heads. The current open-head inventory has66 entries; four changed/new heads were compared. Main retains stronger Files/editor behavior than PR395, Data Lab changes from PR387 are already covered, PR400's alternate autosave semantics must not replace canonical explicit snapshots, and PR399 is deferred pending dependency compatibility acceptance rather than blindly merged.

```sh
git fetch origin main
git status --short
git log -5 --oneline
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:auth
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:learning
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:products
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:landing
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:discovery-gateway
python3 scripts/integration/test-local-postgres.py
npm run db:review-plan
NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 node scripts/benchmark-local-discovery.mjs
# Intentionally NO-GO until real reviewed acceptance evidence is supplied:
npm run release:readiness
```

No production migration, user-data write, agent promotion or live payment was authorized/performed by this batch. Public observations and local successes must not be promoted to77/77 or production readiness.
