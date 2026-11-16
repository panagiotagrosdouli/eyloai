# EYLO checkpoint — read-only production metadata and staging billing safety
Date: 2026-11-16 (Europe/Athens). **Not a release approval.**

## Source and review identity
- Main observed at `c54dd1fd557e4956f230b24ffce1012357c77c6b` (merged PR #487). The earlier full product tracker and open-PR inventory are historical baselines.
- Live Vercel project `prj_yiujFufSKIRnlmZUr9WG7jgf7qKL` in `team_IUkyJtLhpTRBaUikmCSYHBDn`. Production deployment `dpl_E83KGS8VsuLnjwMZjXnp1wCn4CCK` reported READY, domain `eyloai.vercel.app`, Git SHA `c54dd1fd557e4956f230b24ffce1012357c77c6b`.
- GitHub had **81 open PRs** immediately before this checkpoint PR #488 was opened. Historic PR snapshots naming 66 are outdated. Not all PR heads have been reviewed for conflicts; do not merge wholesale.
- Production Supabase project `kbzjngpzxpniaumlupaa` was present and ACTIVE_HEALTHY. A distinct authorized staging project was **not** identified in this connected account.

## Read-only production database inspection
- `public` listed 34 tables; all 34 reported RLS enabled. This **does not** prove policy correctness or two-account isolation.
- 19 recorded migrations; the latest listed was `20261115194359 restore_time_tracker_pause_resume`. This does not prove that every migration in current source has been applied.
- Metadata-only SQL confirmed `projects.updated_date`, `eylo_files`, `eylo_file_versions`, and `time_entries` exist. No user-record bodies, tokens or secrets were fetched; no schema or data writes were made.
- Security advisor: an INFORMATION-level finding says `discovery_rate_limits` has RLS with no policies (possibly intentional for privileged-only quota operations; must confirm grants/role access). An Auth WARNING reports leaked-password protection disabled. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Read-only policy count inspection returned policies on 33 other public tables. This does not replace inspecting exact predicates, grants, Storage policies, session behavior or a real two-user test.

## Narrow implementation increment (draft PR #488)
- Introduce server-only `isBillingTestEnabled` requiring a nonproduction/nonunrelated Supabase staging ref, a verified matching ref in configuration, explicit staging enablement, and Stripe `sk_test_` credentials.
- Enforce this guard on checkout POST and billing availability; a missing/unauthorized gate returns a 503 before outbound calls.
- Require explicit HTTPS `APP_URL` in staging and do not silently fall back to live domain.
- Add/adjust regression tests and explain staging-only variables in `.env.example`.
- No Stripe test checkout or webhook was exercised against a real provider, and webhook handling is not changed in this PR. No production migrations or live billing changes were performed.
- PR: https://github.com/panagiotagrosdouli/eyloai/pull/488. Exact CI results must be read against the current branch head; historical build success is not a pass for future edits.

## Remaining highest-risk acceptance blockers
1. Owner-confirmed *separate* staging project and matching Vercel preview, credentials configured without exposure.
2. Full migration diff and policy review; two disposable users, negative exact-ID RLS tests, and Storage byte-level isolation.
3. Production web route/interaction E2E evidence (rather than READY deployment status), comprehensive public and private navigation, responsiveness and accessibility.
4. Real scholarly retrieval/proxy evidence, human-relevance review, provider outages, DOI provenance and EYRA tool permissions.
5. Stripe test-mode lifecycle including webhook and entitlement idempotence, backup/restore, privacy and legal review, owner final sign-off.
6. Review overlapping PR heads, integrate incrementally with exact-SHA CI and protected preview; do not assume all 77 products are accepted.

## Inherited 77-product matrix (not freshly validated per product)
These statuses are copied only from the in-repository `docs/PRODUCT_IMPLEMENTATION_TRACKER.md` and remain **unaccepted** pending complete current-source, browser, database and staging evidence. No `COMPLETE` promotion was made during this increment.

| ID | Product | Status at inherited tracker snapshot | Newly hosted-accepted? |
| ---: | --- | --- | --- |
| 01 | EYLO Life | PARTIAL | No |
| 02 | EYLO Calendar | PARTIAL | No |
| 03 | EYLO Notes | PARTIAL | No |
| 04 | EYLO Spaces | PARTIAL | No |
| 05 | EYLO Memory | PARTIAL | No |
| 06 | EYLO Notifications | PARTIAL | No |
| 07 | EYLO Personal Dashboard | PARTIAL | No |
| 08 | EYLO Learn | PARTIAL | No |
| 09 | EYLO Study Planner | PARTIAL | No |
| 10 | EYLO Flashcards | PARTIAL | No |
| 11 | EYLO Quiz Generator | PARTIAL | No |
| 12 | EYLO Skills | PARTIAL | No |
| 13 | EYLO Career | PARTIAL | No |
| 14 | EYLO CV Builder | PARTIAL | No |
| 15 | EYLO Interview Simulator | PARTIAL | No |
| 16 | EYLO Files | PARTIAL | No |
| 17 | EYLO Create | PARTIAL | No |
| 18 | EYLO Document Editor | PARTIAL | No |
| 19 | EYLO Presentations | PARTIAL | No |
| 20 | EYLO Spreadsheets | PARTIAL | No |
| 21 | EYLO Universal Search | PARTIAL | No |
| 22 | EYLO Translate | PARTIAL | No |
| 23 | EYLO Knowledge Graph | PARTIAL | No |
| 24 | EYLO Agent | PARTIAL | No |
| 25 | EYLO Workflow Builder | PARTIAL | No |
| 26 | EYLO Automations | PARTIAL | No |
| 27 | EYLO Research Radar | PARTIAL | No |
| 28 | EYLO Voice | PARTIAL | No |
| 29 | EYLO Smart Import | PARTIAL | No |
| 30 | EYLO AI Verification | PARTIAL | No |
| 31 | EYLO Export Center | PARTIAL | No |
| 32 | EYLO Teams | PARTIAL | No |
| 33 | EYLO Meetings AI | PARTIAL | No |
| 34 | EYLO Connect | PARTIAL | No |
| 35 | EYLO Community | PARTIAL | No |
| 36 | EYLO Discover | PARTIAL | No |
| 37 | EYLO Studio | PARTIAL | No |
| 38 | EYLO Activity History | PARTIAL | No |
| 39 | EYLO Admin Operations | PARTIAL | No |
| 40 | EYLO Feature Health | PARTIAL | No |
| 41 | EYLO Auto-Save | PARTIAL | No |
| 42 | EYLO Self-Healing | PARTIAL | No |
| 43 | EYLO Offline | PARTIAL | No |
| 44 | EYLO Accessibility | PARTIAL | No |
| 45 | EYLO Onboarding | PARTIAL | No |
| 46 | EYLO Feedback | PARTIAL | No |
| 47 | EYLO AI Workspace Command Center | PARTIAL | No |
| 48 | Evidence Ledger | PARTIAL | No |
| 49 | Research Reproducibility Studio | PARTIAL | No |
| 50 | Research Collaboration Matcher | PARTIAL | No |
| 51 | Academic Writing Assistant | PARTIAL | No |
| 52 | Methodology Coach | PARTIAL | No |
| 53 | Peer Review Workspace | PARTIAL | No |
| 54 | Project Intelligence | PARTIAL | No |
| 55 | Knowledge Timeline | PARTIAL | No |
| 56 | Decision Workspace | PARTIAL | No |
| 57 | Research-to-Product Studio | PARTIAL | No |
| 58 | Research Intelligence | PARTIAL | No |
| 59 | Thesis Studio | PARTIAL | No |
| 60 | Experiment Lab | PARTIAL | No |
| 61 | Business Intelligence | PARTIAL | No |
| 62 | Literature Review Studio | PARTIAL | No |
| 63 | Citation Network | PARTIAL | No |
| 64 | Research Ethics | PARTIAL | No |
| 65 | Scientific Figures | PARTIAL | No |
| 66 | Research Journal | PARTIAL | No |
| 67 | Academic Supervisor | PARTIAL | No |
| 68 | Conference Hub | PARTIAL | No |
| 69 | Publication Tracker | PARTIAL | No |
| 70 | Research Budget | PARTIAL | No |
| 71 | Smart Forms | PARTIAL | No |
| 72 | Survey Analytics | PARTIAL | No |
| 73 | Data Catalog | PARTIAL | No |
| 74 | Project Templates | PARTIAL | No |
| 75 | Time Tracker | PARTIAL | No |
| 76 | API & Developer Hub | PARTIAL | No |
| 77 | Institutional Portal | PARTIAL | No |

**Release decision: NO-GO.** A passing GitHub build, existing RLS flags, and a READY production deployment are necessary observations but do not satisfy the release gates. This checkpoint contains no authorization to merge, migrate or deploy.
