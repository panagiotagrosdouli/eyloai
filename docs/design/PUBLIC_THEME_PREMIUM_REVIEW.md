# Public day/night and Premium review — 2026-11-14

This batch starts from main `f1350a4`, preserving the company design selected by the owner. The rejected starting-point section from PR411 is not included.

## Implemented

- Shared, scoped light/night palette across the landing, company/contact pages, public plans, discovery, researcher/career entry pages and AuthLayout. The EYLO logo has a night variant that changes only its lettering stroke; the symbol and brand colors are preserved.
- A keyboard-labelled sun/moon control uses the existing `eylo_prefs`/preference events and root theme. It preserves other settings, works after reload and route changes, respects existing system mode, and remains usable when storage writes fail. No parallel preference store was introduced.
- Public Premium presentation on the landing and `/plans`, using the same catalog as authenticated `/pricing`: Free $0, Pro $19/month, Founder $49/month and custom Institution pricing. Paid tiers/prices are explicitly planned; paid cards link to contact rather than checkout. Existing backend capabilities, billing authorization, Stripe settings, keys and webhooks are unchanged.
- Replaced misleading unlimited-AI/popularity copy with usage-limited planned scope. Fixed the authenticated pricing portal guard when billing status fails to load.
- Responsive discovery header wraps its search form on narrow screens; public header controls fit without hiding the hero's discovery action. Auth explanatory/error/success surfaces have paired theme colors rather than light backgrounds with pale night text.

## Executed

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:auth
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
EYLO_E2E_ARTIFACT_DIR=/workspace/work/continuation/public-theme-accepted \
npm run test:e2e:landing
git diff --check
```

`npm run check` passed imports, both TypeScript configurations, lint, all 706 tests with zero failures and production build. Auth browser regressions passed using isolated test doubles. The final Pages production-bundle browser suite passed day/night/system preferences, storage denial, preservation of unrelated preferences, reload/navigation, 320px public/auth layouts, landing widths 320/390/768/1024/1440, keyboard controls, planned pricing and base-aware assets. It checks night Auth explanation contrast by its intended surface and verifies no purchase controls exist on the public plans page. No Auth submission, contact message or checkout is made by the public landing suite.

- [Exact combined check](evidence/2026-11-14-public-theme/check.txt)
- [Exact public browser check](evidence/2026-11-14-public-theme/browser.txt)
- [Exact isolated Auth browser check](evidence/2026-11-14-public-theme/auth.txt)
- [Day landing](evidence/2026-11-14-public-theme/day.png)
- [Night plans](evidence/2026-11-14-public-theme/plans-night.png)
- [Mobile night Premium](evidence/2026-11-14-public-theme/premium-mobile-night.png)
- [Night login](evidence/2026-11-14-public-theme/login-night.png)

Screenshots were visually reviewed. Local browser checks stub font CSS and contact capability; Auth regressions use isolated PostgREST/Storage/session fixtures. These do not establish hosted Auth acceptance, payment readiness, accessibility certification or complete acceptance of all77 products. No remote migration, production publication or live-payment activation was performed. Publication requires explicit approval under the prior automatic approval decision.
