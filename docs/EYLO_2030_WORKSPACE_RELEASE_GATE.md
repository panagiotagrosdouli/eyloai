# EYLO 2030 — Workspace and command quality release gate

This increment is based on the current `main` after the separately merged navigation, token, and categorized-tool-directory changes. It intentionally preserves those updates rather than replaying stale frontend files.

## Implemented

- A lazy-loaded authenticated `/workspace` destination with shortcuts to existing project, note, paper, file, task and calendar features. All existing deep links are retained.
- A five-destination goal-first navigation and EYRA access, with a working searchable mobile tool directory that remains open during input interactions.
- A direct research-question start on Home that still calls the existing `runEyraDiscovery` source-retrieval service; broad topics still enter scope clarification. No autonomous end-to-end review drafting is implied.
- Deferred loading of the detailed home workspace overview until expanded.
- Cmd/Ctrl+K search of canonical registered product tools; shared routing prevents drift between the tool directory and command center.
- An authorized workspace-search query handoff to the existing debounced and permission-scoped `searchWorkspaceSource` service.
- Focus restoration when the command dialog closes and removal of the nested home `main` landmark.
- Source contract tests and a Playwright fixture regression for the mobile directory, command keyboard behavior and workspace query handoff.

## Measured baseline and budget

A previously successful Build workflow for commit `3fe555f916` reported the largest minified JS chunk (`MeetingRoom`) at **593.45 kB**, gzip **156.18 kB**, with Vite's large-chunk warning. This is a build-output baseline, **not** a route load-time or user-experience measurement.

The current feature sets a **700,000-byte raw/minified per-JavaScript-chunk maximum** as an initial regression budget. `npm run build` enforces it through `scripts/check-bundle-budget.mjs`. The build reports the largest chunks and actual gzip sizes; increasing the budget requires a deliberate reviewed code change. This gate does not establish a measured first-load payload or time-to-interactive target.

## Required pre-merge checks

- `npm run check`: imports, types, lint, unit tests, production bundle and chunk budget
- `npm run test:e2e:products`: mobile searchable tools and command handoff, plus preserved product workflows
- Other existing product-quality, authentication, learning and discovery CI workflows
- Browser checks at phone and desktop widths; keyboard-only and screen-reader smoke tests
- Human assessment of research-task completion, with no unmeasured success claims

## Not yet complete

The complete EYLO 2030 mission remains phased work. Full goal orchestration, evidence screening to editable drafts, contextual EYRA authorizations and approvals, usability testing, and accessibility audit evidence are not yet provided by this increment. Do not promote to production before current-head CI and deployment checks pass.
