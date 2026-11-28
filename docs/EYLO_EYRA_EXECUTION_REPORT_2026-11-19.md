# EYLO + EYRA — verified execution checkpoint (2026-11-19)

Status: **NO-GO for general release**. This is an observed, read-only infrastructure and code change checkpoint, **not** an assertion that the end-to-end product is finished. No production database writes, migrations, Stripe billing activation, secrets, account deletion, or production promotion were performed.

## Source identity

| Component | Verified observation | Boundary |
| --- | --- | --- |
| GitHub | Repository `panagiotagrosdouli/eyloai`; base `main` at `a8444c1f931becde6824df15da6c6a15c8f63b84` | Point-in-time observation |
| Vercel | Project `eyloai`, ID `prj_yiujFufSKIRnlmZUr9WG7jgf7qKL` | Confirm environment/alias before release |
| Production | Deployment `dpl_HjbJqiP8qjixKSTgRmsaYx6ejAbs` reported READY with SHA `a8444c1f931becde6824df15da6c6a15c8f63b84` | READY does not prove Auth, AI, billing, or data isolation |
| PR #554 preview | Deployment `dpl_4FBd2xHvasxfBxL9FutY9Kgd7s3A` reported READY on SHA `1c627d883febb61f160f5a427b2afef3bfbcb802` | Preview, **not** a production release or authenticated smoke test |
| Supabase | Connected project `eyloai`, ref `kbzjngpzxpniaumlupaa`, ACTIVE_HEALTHY | This is production, not authorized staging |
| Supabase database branch | `main` branch exists but its migration status reports `MIGRATIONS_FAILED` | Do not treat as a clean independent staging environment |
| Supabase security advisor | `auth_leaked_password_protection` WARN: leaked-password protection disabled | Operator-reviewed Auth configuration change required |
| Supabase security advisor | `discovery_rate_limits`: RLS enabled, no policies (INFO) | Could be intentional server-only deny-all; inspect grants/use before changing policies |

Security references: [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [RLS no policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Code delivered for review

- Draft [PR #554](https://github.com/panagiotagrosdouli/eyloai/pull/554), head `1c627d883febb61f160f5a427b2afef3bfbcb802`: hardens `outputText` / `outputRefusal` against malformed upstream Responses envelopes, with focused regression cases.
- At the time of this checkpoint, its exact-head [Build](https://github.com/panagiotagrosdouli/eyloai/actions/runs/44566692983) and [EYLO Quality Gate](https://github.com/panagiotagrosdouli/eyloai/actions/runs/44566692818) completed successfully; [Product quality](https://github.com/panagiotagrosdouli/eyloai/actions/runs/44566692824) was in progress. **Recheck current conclusion before review or merge.**
- Existing draft [PR #552](https://github.com/panagiotagrosdouli/eyloai/pull/552), head `bba43671d1d0435b6c15ab972c3a0cea05d8e91a`, handles contradictory OpenAI 429 quota fields. Its Build, EYLO Quality Gate and Product quality were reported successful on that exact head. This does not prove funded API quota or live AI 200.

## Mandatory remaining acceptance

1. **Staging:** provision or repair a separate, owner-confirmed Supabase staging environment; explicitly confirm it is not the production ref. Review and rehearse migrations with rollback.
2. **Auth:** provision two disposable accounts and mailboxes. Verify sign-in/out, OTP/signup/reset delivery, redirects, timeout recovery, account switch, expired sessions and negative owner-boundary tests.
3. **RLS and persistence:** under accounts A and B, verify paper/project/researcher/opportunity write, reload, edit, deletion and direct unauthorized read/update/delete of known record IDs. Inspect Data API grants and Storage byte-level isolation.
4. **EYRA:** verify real authenticated OpenAI 200, quota-exhaustion 429, transient 429/timeout, refusal, malformed provider response, cross-user conversation isolation, consent/approval, durable action ledger and retry idempotency. Do not turn on gated writes or claim durable history without the verified tables/RPC.
5. **Scholarly evidence:** inspect real top results across domains, source provenance, metadata errors, partial provider failures, DOI consistency and scientific claim-level review. External EURAXESS upstream failures remain a separate dependency ([#506](https://github.com/panagiotagrosdouli/eyloai/issues/506)).
6. **Billing:** Stripe **test mode only**, webhook signature/replay, checkout/renewal/cancel/failed-payment/entitlements. No live payments without independent operator authorization.
7. **Privacy and UX:** full data export/deletion acceptance, mobile/desktop accessibility and keyboard regression, core paper → library → project → EYRA research journey with actual test accounts.
8. **Release:** exact-head Build, Quality Gate, Product quality, hosted browser acceptance, owner sign-off, production SHA/alias verification, smoke tests, observability and documented rollback. Never promote a preview build or waive quality gates.

Tracking: [#309](https://github.com/panagiotagrosdouli/eyloai/issues/309), [#295](https://github.com/panagiotagrosdouli/eyloai/issues/295), [#507](https://github.com/panagiotagrosdouli/eyloai/issues/507), [#291](https://github.com/panagiotagrosdouli/eyloai/issues/291), [#462](https://github.com/panagiotagrosdouli/eyloai/issues/462), and [launch gate](LAUNCH_READINESS_GATE.md).

## Decision

**NO-GO.** No checked item may be inferred from code, green mocks, a Vercel READY state, or metadata-only catalog inspection. Record reviewer, immutable candidate SHA, exact environment ID, sanitized evidence and explicit GO before any production rollout.
