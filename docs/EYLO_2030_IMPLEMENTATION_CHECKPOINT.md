# EYLO 2030 — implementation checkpoint

## Scope of this change

This is the **first reviewable implementation slice** of the proposed transformation, not completion of phases A–G.

- Primary workspace navigation is goal-oriented: Home, Discover, Workspace, Create, Learn, with EYRA accessible in the header and mobile bar.
- Existing routes and route guards are unchanged. Researcher and career routes remain accessible from the tool directory.
- Mobile tool discovery is collapsed by default, with a searchable directory; desktop retains the existing searchable directory.
- Home includes direct entry points into existing source discovery, library, projects, literature review, quiz and funding workflows; no new AI execution is implied.
- The detailed workspace overview is progressively disclosed rather than immediately competing with the starting task.
- Cmd/Ctrl+K keeps the existing command center and now includes more workflow entry points and the existing authorized workspace search.

## Existing capabilities verified by code inspection

- `src/App.jsx` already uses route-level `React.lazy` and `Suspense`.
- `src/pages/Home.jsx` calls `runEyraDiscovery` for actual source retrieval, handles cancellation, and creates history entries after completed discovery.
- `src/components/layout/GlobalCommandCenter.jsx` uses `cmdk`; its search actions navigate to existing product searches.
- `src/components/dashboard/EyraHome.jsx` loads existing project and research context through `buildUserProfile`.

## Remaining work / boundaries

- End-to-end, constrained goal orchestration and approval gates have **not** been implemented here.
- Existing command palette search is navigation and route handoff, not a federated live result index.
- Context-aware EYRA scopes and tool-level outcomes need explicit permission verification.
- Mobile browser, keyboard/screen-reader, production security and user acceptance tests are pending.
- Baseline and post-change bundles and route timings must be measured in an environment with dependencies installed.
- Existing product features should be audited before migrating their interfaces; do not remove routes or modules to simplify navigation.

## Validation

The repository defines `npm run check` (imports, typecheck, lint, unit tests and build), plus browser scripts. These commands must be run on the feature branch in CI or a network-enabled development environment. This execution environment could read and commit via the GitHub connector but could not clone the repository to run npm, so **no green build or accessibility result is claimed**.

## Next increments

1. Expand the searchable catalog to cover all tool routes in `App.jsx` and add keyboard/route regressions.
2. Map natural-language intent to existing authorized operations, clarify constraints and require approval before writes.
3. Supply scoped EYRA project/paper context with clear access indicators and cancel/retry behavior.
4. Apply a consistent token and responsive system to workflows, then profile bundle budgets.
5. Test mobile, accessibility and first-task completion with students and researchers.
