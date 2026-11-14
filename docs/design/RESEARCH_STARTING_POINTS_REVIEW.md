# Landing activation review — 2026-11-14

The public landing explained EYLO but left visitors to translate its features into their own work. This follow-up makes that next step concrete while preserving the brand, original headline and existing navigation.

## Implemented

- The hero now states the practical progression: find research, think with EYRA, organize notes/projects and take a next step. The primary action says “Start exploring”; the secondary action leads directly to a starting-point chooser.
- A contrasting navy section lets visitors choose a literature review, a new topic or a project plan. Each choice explains a relevant workflow and offers an example question linked to the existing `/discover?q=` contract. Selecting a workflow makes no API request or local-storage change. These are suggested questions, not fabricated search results.
- Pressed-state buttons, a labelled control group and polite detail announcements support keyboard and assistive-technology use. No autoplay, timers, additional dependencies, tracking or signup gate were added.
- The final call to action focuses on the visitor's own question rather than repeating a generic invitation.

## Executed and verified

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
EYLO_E2E_ARTIFACT_DIR=/workspace/work/continuation/landing-activation \
npm run test:e2e:landing
git diff --check
```

`npm run check` passed import checks, both TypeScript configurations, lint, all 706 tests with zero failures, and the production build. The production-bundle browser suite passed the existing landing checks and new keyboard selection/pressed-state/encoded query-link checks. All three starting points fit at 320/390/768px; desktop was checked at 1440px. No uncaught browser errors or failed local brand/build assets were observed. React Best Practices were applied to the component review.

- [Exact check output](evidence/2026-11-14-starting-points/check.txt)
- [Exact browser output](evidence/2026-11-14-starting-points/browser.txt)
- [Desktop visual review](evidence/2026-11-14-starting-points/desktop.png)
- [Mobile visual review](evidence/2026-11-14-starting-points/mobile.png)

This verifies the marketing interaction and query-link contract, not scholarly coverage for the example questions, hosted private workspaces, conversion uplift or accessibility certification. The browser suite uses disposable public configuration and stubs font CSS/contact capability, as documented in the original company landing review. No user records, migrations, payments or AI requests are involved.
