# EYLO 2030 — authenticated UX audit and phased delivery

Status: source-level baseline audit, 2026-11-15. **Not a signed-in browser audit.** A real authenticated session, user data and screenshot access are still required to verify rendered behavior. Findings below distinguish observed code from hypotheses to validate.

## Inventory and baseline

- Routing: `src/App.jsx` declares 60+ protected routes and redirects; routes include discovery (`/search`), projects (`/projects`, `/projects/:id`), Library, Notes, Files, EYRA entry points, Learn, planner, calendar, funding, research gaps, literature review, data lab, knowledge graph, meetings and grants. The app uses React Router, protected layout and lazy-loaded workspace routes. **Keep all paths and redirects working.**
- Navigation: `src/components/layout/AppLayout.jsx` contains primary navigation, an EYRA launcher, an All tools directory/search, mobile bottom navigation, and account/logout controls. `TOOL_GROUPS` mixes research, personal workspace and account destinations. Navigation should be intent-led without hiding actual capabilities.
- Home: `src/pages/Home.jsx` branches into dashboard/search/loading/results, uses `EyraHome` for the dashboard, and offers `PersonalizedDashboard` in an expandable area. Search history is persisted after completed retrieval. Do not replace real discovery with simulated search.
- Styling: `src/index.css` has multiple light/dark and home-specific token scopes, alongside glass, gradient and glow treatments; `tailwind.config.js` exposes HSL semantic color tokens. Shared primitive components live under `src/components/ui`.
- Test harness: npm scripts already include `check:imports`, `typecheck`, `lint`, `test`, `build` and `check`; Playwright is a dev dependency, with focused end-to-end scripts under `tests/`.

## Issues and opportunities, ordered by risk

| Priority | Area | Source evidence / issue | Action and validation |
| --- | --- | --- | --- |
| P0 | Global wayfinding | Main navigation previously included a task-specific Create route as a primary destination, while the directory also listed Create and workspace destinations. | Expose stable user goals; preserve direct document link inside directory. Verify every legacy deep link. |
| P0 | Theme parity | A home-specific light palette appears after shared dark-mode definitions. | Restore semantic dark home values; screenshot Home in both themes. |
| P1 | Directory | Tool groups include 20+ workspace actions and separate Account items; the full inventory is searchable but dense. | Introduce purpose-based groups, concise tool descriptions, search synonyms and shortcuts. Test first-time discovery. |
| P1 | Home | Dashboard plus an expandable personalized section can dilute the first interaction. | Keep one EYRA prompt, 4–6 starting actions and context-sensitive recent work. Validate empty/loading/error states. |
| P1 | Visual consistency | CSS includes decorative glow/glass styles and multiple token overrides. | Migrate surfaces to semantic tokens incrementally; avoid broad destructive CSS resets. |
| P1 | Mobile | Mobile menu duplicates tool access and bottom bar presents separate navigation destinations. | Validate 320, 390, 768 widths, keyboard/menu dismissal, safe-area insets and target sizes. |
| P1 | EYRA | Dialog launchers and capability gating exist. | Verify real states for streaming, waiting, failed and permission-gated actions; never show synthetic completion. |
| P1 | Scientific workflows | Discovery, literature review, gaps, data lab and grant pages have distinct entry points. | Add consistent title, task-specific example and next-step states while retaining necessary parameters and evidence provenance. |
| P2 | Accessibility | Global focus and reduced-motion CSS exist, but source inspection cannot establish WCAG compliance. | Automated axe and manual screen-reader/keyboard audits for critical flows. |
| P2 | Performance | Workspace routes are lazy-loaded already. | Measure navigation timing, interaction responsiveness, chunk size and Web Vitals before further optimization. |

## Batch 1 implementation

- Simplified primary destinations to **Home / Discover / My workspace / Learn**, while retaining the dedicated **Ask EYRA** launcher and **All tools** dropdown. Existing routes, deep links and grouped directory entries were not deleted.
- Adapted the mobile bottom bar from six to five slots (four primary destinations plus EYRA). All tools remains in the mobile menu.
- Added named spacing, radius, surface shadow and content-width tokens scoped to the authenticated canvas.
- Fixed the authenticated Home light-palette override when the root theme is dark.
- Kept accessibility focus rings and reduced-motion behavior explicit.

## Validation gates

**Not yet executed in this environment:** npm install, lint, typecheck, unit tests, production build, Playwright, screenshots, a logged-in session, Lighthouse, axe, or moderated first-time user tests. These are mandatory before marking this batch ready for merge.

1. Run `npm run check` on the branch in CI or a local checkout.
2. Verify key routes directly: `/home`, `/search`, `/projects`, `/library`, `/notes`, `/files`, `/learn`, `/study-planner`, `/opportunities`, `/research-gaps`, `/literature-review`, `/labs/data`, `/knowledge-graph`, `/meetings`, `/grant-builder`, and `/tools/:tool`.
3. Compare authenticated desktop and mobile screenshots at 320, 390, 768, 1024 and 1440 pixels in light and dark modes.
4. Keyboard test the All tools menu, search, EYRA launcher, sign-out and navigation, including Escape and focus return.
5. Record actual pilot completion rates for: find a paper, save it, create a project, ask EYRA, create a plan and find funding. The 30-second / 3-interaction / 90% targets are **unverified goals**.

## Planned next batches

- **2 — Information architecture:** finish goal-based tool taxonomy and breadcrumb strategy with route compatibility tests.
- **3 — Home:** present one prominent EYRA input, useful starts, recent projects and available deadlines; verify live empty/error states.
- **4 — Discovery and workspace:** paper-to-Library-to-Project flow, resumable work and useful feedback.
- **5 — EYRA and learning:** transparent agent states, contextual assistance and planner UX.
- **6 — Advanced tools:** normalize research gaps, literature protocol, data lab, graph, meetings and grants.
- **7 — Mobile / accessibility / performance:** fix verified blockers and compare performance metrics.
- **8 — Regression / pilot validation:** run automated and human task tests and resolve regressions.

Do not merge or deploy any batch without explicit authorization.
