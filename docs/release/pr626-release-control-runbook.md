# EYLO release-candidate PR #626 — frozen read-only evidence, 2026-11-27

This snapshot refers ONLY to PR #626 commit \`23ebb1d34aac45485a12c38ea6a4eaa47ea2e7c0\`, not to the newer release-preflight PR or to the unrelated open work on #627/#628. It records read-only observations and is **not deployment authorization**.

Run \`node scripts/verify-release-candidate-manifest.mjs\` to check the manifest's internal integrity and lockfile byte-for-byte Git blob identity, or run the \`release-candidate-manifest.test.mjs\` unit regressions. This local check does **not** connect to GitHub, Supabase, Vercel, Stripe, Crossref or OpenAI, and cannot certify that those platforms still have the same state.

## What was verified

- \`main\` at \`ffc79b8d4dac82cef5c3f98b12f6a2a328442ef1\` on 27 November; branch \`main\` reports **protected=false**, GitHub repository rulesets \`[]\`.
- GitHub Pages workflow \`.github/workflows/deploy-pages.yml\` deploys on **push to main** and **workflow_dispatch**. Its deployment job targets the \`github-pages\` environment. The authenticated GitHub connector cannot inspect the effective Pages environment protection rules.
- Vercel team \`team_IUkyJtLhpTRBaUikmCSYHBDn\`, project \`prj_yiujFufSKIRnlmZUr9WG7jgf7qKL\`. Production deployment \`dpl_62wpJQvwLSrKLSdxBVfJLfj9GAE7\` was READY for \`main\` at the above SHA; candidate Preview \`dpl_phcuEwagFKp4DZfhShpcp3WXVAD3\` was READY for the frozen #626 SHA, with \`target=null\` (non-production). Git integration thus auto-builds PR previews and historically auto-built production from main. Do **not** assume a preview is usable by anonymous testers: Vercel project SSO protection was enabled for non-custom domains.
- GitHub Build run 45934981883, EYLO Quality Gate 45934981888 and Product Quality 45934981855 all PASS on **exact #626 SHA**, 1,326 unit tests/0 failures. All browser fixtures are **synthetic/local**. No independent hosted security/real provider test was performed.
- Supabase read-only inventory lists active production \`kbzjngpzxpniaumlupaa\` and unrelated inactive \`eqgukmgmmbpxjstleipe\`; a default Supabase development branch lists \`MIGRATIONS_FAILED\`. Neither is an approved isolated staging target. The release-preflight follow-up also rejects the unrelated inactive project as staging.
- Draft PRs #627 and #628 introduce separately unmerged scientific/grant corrections. They are not part of frozen #626 and must be assessed independently before selecting an eventual release candidate.

## Reversible owner-controlled release procedure

1. GitHub Settings → Rules → Rulesets (or Branches): create and enforce a \`main\` protection policy. Require independent PR approval and matching exact-head Build, EYLO Quality Gate, and Product Quality checks, disallow bypass/force pushes and require CODEOWNERS where useful. Verify the applied rule from an authenticated admin account, including that it cannot be circumvented by the owner.
2. Confirm Vercel Settings → Git → **Production Branch = main** and the automatic deployment behavior. Confirm GitHub Pages Settings → Build and deployment and the \`github-pages\` environment gate. Have the owner specify and document the reversible suppression/promotion control for *both* hosts before authorizing a merge. Existing previews must not be promoted automatically.
3. Freeze a **new** exact integration SHA after reviewing #627/#628 and other unmerged changes, run \`npm ci\`, \`npm run check\`, \`npm run release:readiness\` and its complete exact-head hosted browser suite. Require **independent reviewer signoff** before a final merge, even if CI passes.
4. Obtain an explicit, separate owner-authorized Supabase staging project ref **different from production and unrelated projects**, URL, publishable browser key, exact Vercel Preview SHA/URL/deployment ID, two authorized disposable inboxes/accounts, ephemeral write consent and fixture-only cleanup permission. Independently verify staging project identity, Preview identity and service environment before credentials/writes. No production keys or user records. Only then run sign-up, two-account Auth/RLS/Storage negative tests, persistence, history isolation, deletion and cleanup.
5. Separately budget and authorize live authenticated EYRA/OpenAI calls, official-call document acceptance, expert scientific evaluations, privacy/deletion, migration reconciliation and Stripe **test-mode** lifecycle. Record evidence and adverse results in restricted evidence storage; do not post test credentials or human review data to this public repository.
6. Only after all mandatory gates independently pass: owner authorizes an explicit, reversible main merge plus promotion. Record main SHA, Pages deployment, Vercel production deployment ID, migrations (if any), signoff identities and post-deploy smoke checks.

## Rollback (authorization required)

Owner selects a **verified READY** prior Vercel production deployment for rollback/promotion (the historical \`dpl_62wpJQvwLSrKLSdxBVfJLfj9GAE7\` is evidence of an earlier main deployment, not a guarantee it remains promotable). For GitHub Pages, use a reviewed revert to restore previously approved assets; a revert on main also initiates deployment. Coordinate both hosts, inspect \`release.json\` / commit identities and validate session/data compatibility. Never silently roll back production databases or subscriptions.

**Decision: NO-GO.** Missing evidence is BLOCKED or NOT RUN, never PASS. An internal manifest cannot authorize production.
