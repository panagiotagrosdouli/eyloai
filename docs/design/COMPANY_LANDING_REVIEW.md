# Public company landing review — 2026-11-14

EYLO's anonymous entry page now explains the connection between scholarly discovery, EYRA and the private research workspace before asking visitors to sign in. The existing logo, white/navy/blue palette and headline remain. Company and contact introductions use the same positioning.

## Implemented

- Company navigation, three connected capabilities, an EYRA introduction using its original brand asset, a three-step research journey, audience use cases, principles, FAQ and grouped corporate footer.
- Keyboard-operable Discover/Workspace/EYRA preview tabs. The preview is explicitly illustrative; it contains no invented scholarly records, generated answers, testimonials or adoption figures.
- Mobile navigation with Escape/focus restoration, a skip link, visible focus states, semantic landmarks and reduced-motion support scoped to the public landing.
- GitHub Pages-aware logo paths, coherent social descriptions and visitor-facing contact-unavailable copy. Existing contact capability checks remain.
- A repeatable production-bundle browser regression in Product quality CI.

## Executed and verified

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
EYLO_E2E_ARTIFACT_DIR=/workspace/work/continuation/company-landing-reviewed \
npm run test:e2e:landing
git diff --check
```

`npm run check` passed imports, both TypeScript configurations, lint, all 706 tests (zero failures) and the production build. The landing browser suite passed, and `git diff --check` was clean. See [check output](evidence/2026-11-14-company-landing/check.txt) and [browser output](evidence/2026-11-14-company-landing/browser.txt) for exact outcomes. Browser verification builds the actual production bundle with `EYLO_GITHUB_PAGES=true` and serves it locally at `/eyloai/` using disposable public configuration. It verifies 1440/768/390/320px layouts, all three preview states without horizontal overflow, keyboard tabs/FAQ/skip link, mobile menu behavior, canonical/base paths and navigation to the real company/contact/register/discovery routes. No uncaught browser errors or failed local brand/build assets were observed.

The browser test stubs external font CSS and the contact capability response. It does not submit Auth or contact requests, query a hosted database, or establish that hosted registration/contact delivery works. Local landing visits made no Auth requests. Existing product acceptance evidence and release blockers remain separate.

## Visual review

- [Desktop, 1440px](evidence/2026-11-14-company-landing/desktop.png)
- [Mobile, 390px](evidence/2026-11-14-company-landing/mobile.png)

Both captures were reviewed for hierarchy, legibility, brand consistency and layout. Automated keyboard/responsive checks are bounded regression checks, not a claim of exhaustive accessibility conformance.

## Publication

Prepared for review on the integration branch. No merge, GitHub Pages publication, production promotion, remote migration or production data change was performed as part of this review.
