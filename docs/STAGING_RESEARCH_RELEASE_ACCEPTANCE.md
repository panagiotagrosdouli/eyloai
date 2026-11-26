# EYLO hosted research and release acceptance

**State: prepared; hosted acceptance has not been run. Production remains NO-GO.** This runbook assembles existing guarded procedures with the research evaluation cases in `tests/fixtures/research-evaluation/urban-tree-heat.json`. It does not authorize migration application, billing activation, production access, or account deletion.

## 1. Exact staging requirements

Before any hosted acceptance, the owner must identify and approve one active Supabase project and one Vercel Preview target that are distinct from production. Use a new staging project with synthetic/disposable data; do not clone user rows, files, Auth records, or production secrets. Record:

- Supabase project reference, canonical `https://<ref>.supabase.co` URL, owner confirmation, active state, and the account/team that controls it.
- Vercel team and project IDs, linked repository and production branch, Preview environment, and the exact deployment SHA. `dist/release.json` and `/api/deployment-status` must identify the reviewed commit. A protected Preview login page is an access control, not a validation result.
- Staging-only publishable/anon key in browser configuration and server credentials in protected server configuration. Never use a service-role key in browser variables, local fixtures, CI output, chat, or this repo.
- `EYLO_ENVIRONMENT=staging`, matching `EYLO_STAGING_SUPABASE_REF` and `EYLO_STAGING_CONFIRMED_REF`, exact matching `VITE_SUPABASE_URL`, `VITE_SUPABASE_USE_PROXY=false`, and `VERCEL_ENV=preview`. The existing `scripts/verify-staging-config.mjs` rejects known production/unrelated refs and does no remote work.
- At least two distinct disposable, non-anonymous Auth accounts, separate test inboxes, and an accountable operator. Store passwords and temporary JWTs in a secret manager or private ephemeral shell; never save them in fixtures or evidence artifacts.
- A staging-only OpenAI provider/model and budget, scholarly API configuration, Stripe test-mode account and webhook secret, and any other required providers. Leave missing capabilities disabled. Provider/model/version and prompt/context metadata must be recorded or labeled unavailable.

Run `node scripts/verify-staging-config.mjs` before building. It is a configuration guard only; it does not verify hosted Auth, RLS, Storage, or provider behavior.

## 2. Non-destructive migration-history reconciliation

Do this read-only sequence before deciding whether any DDL is needed:

1. Independently verify the staging project identity and capture the exact deployed SHA. Do not query or write until owner, Supabase ref, Vercel project, and deployment identity all agree on staging.
2. In the staging SQL editor, export only migration version/name metadata and current schema metadata needed for review. Keep the export private. Do not include user rows, credentials, `statements` text, or secrets in the PR.
3. Compare versions using `node scripts/check-remote-migration-history.mjs /path/to/private-remote-versions.json`. Compare full applied SQL fingerprints to reviewed local migration contents using the existing reconciliation artifacts and `npm run db:review-plan`. These are audit reports only, not migration approval.
4. Classify remote-only versions, local-only files, name/version remaps, exact SQL matches, divergent SQL, dependencies, side effects, and historical replay hazards. Specifically review the documented `profiles.id` versus `profiles.user_id` historical ordering hazard; a later bridge migration does not make replaying an earlier file safe.
5. Rehearse any proposed migration sequence against a network-disabled disposable database initialized with the target's verified pre-migration schema. Review backup/restore and rollback behavior. A successful local replay is not hosted staging acceptance.
6. Produce an owner-reviewed mapping and an exact SQL/change plan. Stop here. Any later staging migration requires a separate explicit owner approval for the named staging ref, exact reviewed SQL, backup, operator, and rollback plan. Never use `db push`, `migration repair`, filename renames, or blanket replay to make histories appear aligned. No production migration is authorized by this runbook.

Existing references: `scripts/check-remote-migration-history.mjs`, `scripts/review-migration-plan.mjs`, `scripts/check-legacy-profile-replay.mjs`, and `docs/release/SUPABASE_APPLIED_SQL_RECONCILIATION_2026-11-20.md`. The current audited history has timestamp/name mismatches and a documented divergent security migration; re-query staging rather than treating the historic production snapshot as staging evidence.

## 3. Executable acceptance procedures

Run local regression commands first. These use fixtures, not hosted acceptance:

```bash
npm run check
npm run test:e2e:auth
npm run test:e2e:session
npm run test:e2e:learning
npm run test:staging:storage # refuses to run without a fully configured, explicitly authorized staging target
node scripts/validate-research-evaluation-fixture.mjs
node --test tests/research-evaluation-fixture.test.mjs tests/eylo-file-storage-staging-guard.test.mjs
```

| Area | Hosted procedure | Pass evidence and limits |
|---|---|---|
| Authentication and recovery | In the isolated Preview, use each disposable account to sign in, sign out, reload, expire/refresh a session, request password recovery, receive the actual message in the matching test inbox, follow the one-time link, set a new password, and verify the old password fails. Keep links/tokens private. | Record each account and browser by pseudonymous code. Mocked `npm run test:e2e:auth` is not email-delivery proof. Do not use a real person's inbox. |
| Two-account RLS | With protected staging env values, run `node scripts/verify-rls-two-accounts.mjs` for owner-row and cross-read checks. Then run `EYLO_STAGING_ALLOW_EPHEMERAL_WRITES=YES npm run test:e2e:project-concurrency` only after explicit authorization for ephemeral project writes; it uses two sessions for one disposable owner plus a distinct outsider and cleans its fixture. | Require owner rows for both identities, foreign reads hidden, unauthorized update blocked, stale save rejected, late EYRA output unable to overwrite a researcher edit, and cleanup verified. Empty fixtures are inconclusive. Collaboration policies need separate role/consent review. |
| Storage access | `npm run test:staging:storage` runs the existing `createEyloFilesService` against two disposable users, uploads unique synthetic text, verifies owner metadata and exact bytes, adds a second version, probes foreign read/update/delete, then removes its fixture through the owner account. It requires the explicit `EYLO_STORAGE_ALLOW_EPHEMERAL_WRITES=YES` acknowledgement. | Requires `EYLO_STORAGE_SUPABASE_URL`, `EYLO_STORAGE_PUBLISHABLE_KEY` (also exactly `VITE_SUPABASE_ANON_KEY`), `EYLO_STORAGE_TEST_A_EMAIL/PASSWORD`, `EYLO_STORAGE_TEST_B_EMAIL/PASSWORD`, plus exact confirmed staging refs. Never use a service-role key. Any cleanup failure prints only the generated fixture ID and staging ref for operator recovery. |
| EYRA provider | In the staging Preview, run the seven cases in the fixture with selected public records only. Test one normal response, one evidence-insufficient question, cancellation, provider timeout/rate error, and a source-conflict comparison. Do not request project writes. Separately run `node scripts/eyra-hosted-ab.mjs` only for the existing two-account hosted conversation persistence test; it is not a live-provider quality test. | Capture exact provider/model/version (or unavailable), prompt/context selection, selected PMID/DOI values, output, errors and latency in the private study record. Two domain researchers independently rate claim support against available original text. Source identifier resolution is recorded separately and never counts as semantic support. |
| Research artifact persistence | In the isolated Preview, perform discovery → matrix → review → proposal → methodology → roadmap; save and reload each artifact, edit one researcher note, force a stale-version conflict in a disposable project, export Markdown/CSV, and verify the note, exact selected source IDs, conflict behavior, and workplan after reload. | The automated `npm run test:e2e:learning` covers a mocked product flow. For hosted acceptance, keep a screen/evidence record with synthetic content and verify persistence under each account. Generate-only must not alter `plan_items`; explicit selected-task approval and a separate workplan save are both required. |
| Privacy and account deletion | First complete Auth/RLS/Storage acceptance and review `docs/integration/ACCOUNT_DELETION_CONTRACT.md`. Use a dedicated free, password-authenticated disposable account with no MFA, passwordless access, Stripe secret/webhook, customer, subscription, or paid entitlement. Test cancelled consent and wrong receipt before one owner-approved end-to-end deletion of the disposable account; verify old sessions/tokens fail, Storage bytes are gone, second-account data remains, and the receipt reports completion. | Account deletion is irreversible. The staging deletion lifecycle must already be reviewed/applied under separate staging-only migration approval. Keep automatic crons disabled; use the documented scoped worker only for the exact confirmed fixture job. Browser/Postgres mocks are not hosted Auth/Storage or legal erasure acceptance. Stop if any fixture is not clearly disposable. |
| Stripe lifecycle | Owner separately configures only Stripe test-mode keys, test price IDs, and a test-mode webhook endpoint in the isolated Preview. Use the application checkout with test payment method, verify signed webhook delivery and entitlement, retry a duplicate event, test renewal, cancellation and failed-payment recovery, then verify entitlement state and private account separation. | Record Stripe account mode, test event IDs, staging deployment SHA, and final entitlements, but never keys or card data. Test-mode checkout/webhook evidence is not live billing authorization. Do not enable live mode, change production keys, or incur a real charge. |

## 4. Research evaluation records

The source fixture contains three real PubMed-indexed articles with PMIDs, PMCIDs, DOIs, canonical records and study-scope notes:

- Ettinger et al. (2024), sidewalk air-temperature observations in Tacoma: [PubMed 38351140](https://pubmed.ncbi.nlm.nih.gov/38351140/), [PMC10864265](https://pmc.ncbi.nlm.nih.gov/articles/PMC10864265/), DOI `10.1038/s41598-024-51921-y`.
- Schwaab et al. (2021), satellite land-surface-temperature analysis in 293 European cities: [PubMed 34815395](https://pubmed.ncbi.nlm.nih.gov/34815395/), [PMC8611034](https://pmc.ncbi.nlm.nih.gov/articles/PMC8611034/), DOI `10.1038/s41467-021-26768-w`.
- Ziter et al. (2019), bicycle-mounted urban air-temperature sampling in Madison: [PubMed 30910972](https://pubmed.ncbi.nlm.nih.gov/30910972/), [PMC6462107](https://pmc.ncbi.nlm.nih.gov/articles/PMC6462107/), DOI `10.1073/pnas.1817561116`.

`node scripts/validate-research-evaluation-fixture.mjs --verify-pubmed` performs read-only PubMed identifier/title/DOI/PMC checks. A pass proves record identity only. It does not rate relevance, assess a claim against evidence, or represent human researcher evaluation. No evaluation participant or output is included in this fixture.

## 5. Record outcomes and stop conditions

For every hosted run, record exact application SHA, Preview ID, verified staging ref, browser/OS/viewport/input mode, test-case version, pseudonymous account codes, command or task, result (`PASS`, `FAIL`, `BLOCKED`, `NOT RUN`), sanitized evidence, cleanup status, and reviewer. Do not include JWTs, emails, password-reset URLs, private research content, or provider credentials.

Stop the run for any cross-account exposure, researcher edit loss, roadmap write without approval plus separate save, incorrect receipt, unexplained data mutation, production target, live Stripe mode, failed cleanup, private data exposure, fabricated citation, or ambiguous environment identity. Record the outcome as blocked/failed and preserve only evidence that can be safely retained.

**Current state:** there is no confirmed isolated hosted staging environment or authorized test accounts in this work session. No hosted test, migration, Auth/Storage write, deletion, provider call, Stripe action, production data change, or deployment was performed. Production remains NO-GO.
