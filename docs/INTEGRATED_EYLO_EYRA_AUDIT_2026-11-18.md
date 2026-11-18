# EYLO + EYRA integrated implementation and release review — 2026-11-18

Status: **OPEN / NO-GO**. This is a read-only discovery and integration plan, not permission to merge, run production migrations, enable billing, or deploy. Target baseline: main `2ca9eb5df1a73960479d3deba3688e9f81b59961` (observed 18 November 2026). Evidence is time-specific and must be refreshed on the exact candidate SHA.

## Verified live observations (18 November 2026)

| Check | Observation | What it does NOT establish |
| --- | --- | --- |
| GitHub | Main includes #537; #528, #530, #531 and #536 are open draft PRs | No integrated candidate has been approved |
| Vercel | Project `eyloai`, production deployment `dpl_7P1JVJfwat7H6MohGKeBmDg7yV7Q` READY; metadata points to main `2ca9eb5d`; domain `eyloai.vercel.app` | READY is not a successful API, auth, scientific or payment acceptance test |
| Supabase project identity | Connected project `kbzjngpzxpniaumlupaa` named `eyloai`, ACTIVE_HEALTHY | Does not establish row isolation or service configuration |
| EYRA schema | Read-only catalog inspection found `eyra_usage_actions` (RLS enabled), but **none** of `eyra_conversations`, `eyra_messages`, `eyra_agent_runs`, `eyra_agent_actions`; no `save_eyra_conversation_snapshot` function | Do not enable durable-history or approved-write flags; do not apply migrations to production |
| Security advisors | `auth_leaked_password_protection` WARN: leaked-password protection disabled; `discovery_rate_limits` RLS enabled without policies INFO | No-policy server-only table may be intentional; inspect grants and server-only use before any change |
| #536 CI | Exact head `79bdff30a8abd00297bb1aac1e4c92ec541c17b2`: Build, Product quality, EYLO Quality Gate all successful | Does not prove hosted two-account RLS or operational rollback |
| #531 CI | Exact head `488c6fec8f6a6faa84d831cd47bafe8c0c0a7bbb`: Product quality and disposable PostgreSQL preflight successful | Does not prove all checks on a combined integration SHA |

Sources: GitHub PRs #528/#530/#531/#536 and workflow runs, read-only Supabase catalog + security advisors, and Vercel project/deployment metadata. Do not place JWTs, secret values, customer records, or full service logs in release evidence.

## Dependency-aware PR integration

- `#528` is a draft integrated UX/auth/workspace candidate. Its GitHub mergeability is currently false and it was based on an earlier main. Rebase/reconcile with current main without silently overwriting newer features. Re-run exact-head CI.
- `#530` is **stacked on #528**: honest EYRA cloud-history degradation plus local export. Do not cherry-pick blindly or claim real server persistence.
- `#531` is **stacked on #530**: fail-closed EYRA staging schema preflight. Do not merge it into main separately from its prerequisites.
- `#536` targets main independently and adds bounded canonical exact-field approval, signed token limits and concurrency tests. Review overlapping EYRA files and conflict surfaces before combining.
- Other open UX PRs #522 and #524 may overlap #528. Inventory changed files against current main and keep one canonical implementation per feature. Supersede stale duplicates only after independent review.

### Integration sequence

1. Freeze an exact candidate SHA and list overlapping files/commits. Identify where the same fix already exists on main.
2. Integrate non-schema, non-billing fail-closed safety changes first, with unit and browser tests.
3. Integrate #528 -> #530 -> #531 in dependency order on a disposable integration branch. Resolve conflicts intentionally and preserve existing deep links.
4. Reconcile #536 exact-field approval separately, retaining the default-off write flag.
5. Run **Build, Product Quality, EYLO Quality Gate and disposable PostgreSQL** on the final, single SHA. Preserve CI URLs in evidence.
6. Review the combined diff for user-visible functionality, migration ordering, auth ownership, error states, and API compatibility.
7. Only then request independent staging acceptance and owner release decision. No implicit production promotion.

## Track A — Technical audit & security

**P0:** Verify repo default-branch protections, least-privilege CI permissions, secret exposure and service-role separation. Assert 401/403 ownership failures; invalidate account-switch stale results. Review request-size caps, SSRF restrictions, provider timeouts, quota reservation/release and idempotency on ambiguous retries. Run controlled dependency and SAST review; report false positives rather than automatically bumping major versions.

**P0 security advisor follow-up:** Evaluate enabling Supabase leaked-password protection with an operator-reviewed Auth change plan; check effect on account-recovery/registration tests. For `discovery_rate_limits`, inspect intended service-only grants: an RLS-enabled table without policies may deliberately deny Data API access, so never add broad user policies to remove an INFO notice.

**Gate:** `npm ci`, `npm run check`, disposable PG tests, browser auth/session/library tests and no new P0 security findings on exact integration SHA.

## Track B — EYRA Next

**P0:** Leave cloud conversation Save disabled if backend schema/RPC cannot be confirmed; keep local conversation export. Preserve explicit error distinctions: unavailable schema, auth/permission failure, temporary network failure. Do not claim save success from a preview.

**P0:** Keep all tool writes default-off pending signed exact-field confirmation, server-side ownership, bounded canonical fields, retry-safe ledger and two-account RLS. An LLM tool proposal is not authorization.

**P1:** Split orchestration into testable auth, quota, retrieval, evidence, provider, tool registry and UI boundaries. Distinguish retrieved metadata, full-text evidence, interpretation and unresolved claims. Use citation-ID checks **and** human claim-level verification.

**Gate:** sample actual external records, adversarial prompt injection, DOI/source integrity, duplicate idempotency and provider 429/timeout/retry tests. Run separate evaluation by research domain, beginner/expert intent and support status, not a single aggregate model score.

## Track C — Production readiness

**P0 NO-GO until:** verified staging identity separate from production; migrations reviewed and rehearsed there with rollback; real two-user JWT/PostgREST read/update/delete isolation; missing EYRA schema resolved there; real OpenAI 200 and controlled 429; public discovery with live quota RPC, upstream timeout/partial results; operational backup/restore; exact deployed commit matched with reviewed PR.

**P1:** Stripe test checkout/webhook/renewal/cancellation/entitlements and duplicate event cases; SMTP delivery and password reset; data export/deletion scope; monitoring and alerting. Live Stripe activation requires separate approval.

Operator checks (do not publish raw environment output):
```sh
npm run check
npm run release:readiness
npm run db:review-plan
npm run config:check
npm run release:probe -- https://eyloai.vercel.app
```
The last two commands only make sense on the intended configured environment; public probe consumes normal quota. Never infer production state from an unconfigured checkout.

**Gate:** reviewer fills `docs/LAUNCH_READINESS_GATE.md` with immutable SHA, environment identity, test outcomes, evidence links, rollback owner and explicit GO/NO-GO.

## Track D — UX/UI & scientific journey

Use an intentional sequence: **Home / Discover / Workspace / Learn**, with a prominent Ask EYRA and searchable tool directory. Keep all existing routes/deep links. Avoid success-shaped UI for unavailable capabilities.

- Home: one clear entry prompt, recent project continuation, real loading/empty/error states.
- Discover: source provenance, DOI/URL, partial-provider failure, record grouping, Save to Library -> Project transition.
- Workspace: recoverable navigation, ownership-aware exports, clear context, project actions and signed-out behavior.
- EYRA: distinguish thinking, retrieving, citation validation, preview, approval, action success/failure; provide keyboard and screen-reader status.
- Validate authenticated routes at 320/390/768/1024/1440 widths and both themes, keyboard/ESC/focus return and screen-reader landmarks. The existing `npm run test:e2e:ux` is **opt-in**, requires an authorized signed-in storage state, and must not receive production real-user credentials or export screenshots to public CI artifacts.

**Gate:** no horizontal overflow, no broken deep links, explicit permission and outage states, and observed user success on: locate paper -> inspect source -> save -> attach to project -> ask EYRA. Human usability metrics are not yet verified.

## Scientific performance measurement

Use `docs/DISCOVERY_EVALUATION.md`: frozen heterogeneous questions, independent relevance labels, Precision@5/10, nDCG@10, duplicate/noise/zero-result and provider diversity with per-domain breakdown. Run retrieval and EYRA answer evaluations separately; do not interpret citation counts or heuristic anchor coverage as scientific validity.

## Owner-controlled execution record

- [x] Read-only GitHub PR / workflow / code/config inventory
- [x] Read-only Vercel project/deployment identity
- [x] Read-only Supabase EYRA catalog inspection and security advisor snapshot
- [ ] Integrated code branch and exact-head CI of all combined changes
- [ ] Dedicated reviewed staging Supabase and two-user hosted tests
- [ ] Real OpenAI, scholarly retrieval, SMTP and Stripe test-mode acceptance
- [ ] Authenticated full UX/browser and accessibility acceptance
- [ ] Migration rehearsal, recovery, rollback and operational sign-off
- [ ] Explicit owner GO decision and controlled production rollout

**Decision: NO-GO**. The above checks are not a request to apply database changes or to promote a deployment. Keep all feature flags fail-closed until their exact prerequisites are met.

## Implemented audit-branch remediation (PR #538; not deployed)

The audit branch includes independent, low-risk changes beyond documentation:

1. GitHub workflows now use least-privilege `contents: read` for Build and no persisted checkout credentials for Build, Product Quality and EYLO Quality Gate. No workflow receives new secrets.
2. `api/eyra-conversations.js` uses shared PostgREST-code classification for 404 missing EYRA table/RPC errors. Missing hosted schema returns an explicit sanitized 503 `EYRA_CLOUD_HISTORY_UNAVAILABLE`, not a fake empty response. Permission/auth errors return a separate sanitized denial; temporary provider failures remain service unavailable. Existing bearer authentication, owner filter, no-store and GET-only contract remain.
3. New Node tests cover pure error classification **and** actual handler responses for missing schema, access denial, transient outage, authenticated empty list and bad user token. No live user data is touched.
4. `src/lib/eyra-command-evidence.mjs` now explicitly marks fetched provider metadata as untrusted prompt context and tells the assistant not to execute embedded instructions; a unit test ensures the security boundary precedes the hostile provider payload. This is defense-in-depth, **not** a claim of prompt-injection immunity.

**Integration risk:** #530 will also change the EYRA cloud history UX and must be reconciled after review. Do not claim that the new API classification alone enables cloud conversation saving. #528/#530/#531 are **118 commits behind main** when compared on 18 November, and their combined changes should not be force-copied into this branch. #536 is 2 commits behind the current main; rebase and rerun exact-head checks when constructing a combined candidate.

**Validation:** The latest branch commit must pass Build, Product Quality and EYLO Quality Gate. Read-only inspection of PR statuses is not a substitute for a successful final-head CI result.
