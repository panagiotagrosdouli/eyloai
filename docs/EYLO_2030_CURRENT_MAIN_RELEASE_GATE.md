# EYLO 2030 — Current main integration / release gate

Updated against the current `main` following merged screen, authenticated experience, document, literature review, EYRA, and tool-directory work. The branch **does not replace those components with older implementations**.

## Delivered

- Five goal-first navigation destinations with a protected, lazy `/workspace` hub and existing deep links preserved.
- Searchable mobile tools directory remains interactive when a user clicks and types into it.
- Cmd/Ctrl+K uses the canonical product registry and forwards saved-work search queries into existing authorized workspace search.
- Research requests using explicit goals (e.g. preparing a literature review) map deterministically to a supported discovery profile, with evidence still retrieved through the original discovery service.
- Research search does **not** silently write SearchHistory records; explicit Save search remains the persistence action.
- Creating a project from search results discloses seed record writes and can transition to the same project's human-reviewed literature protocol.
- The secondary homepage dashboard mounts only upon intentional expansion.
- Production build checks largest minified JavaScript chunk against a 700,000-byte budget (initial measured 593.45 kB baseline).
- Source-level regression checks and opt-in browser UX smoke coverage include the Workspace route.

## Required before merge and production

1. Run `npm run check`, Build, EYLO Quality Gate, Product quality, plus browser smoke on actual SHA.
2. Verify auth/account isolation, clipboard and project write consent, mobile widths including 320 px, keyboard focus and screen-reader landmarks.
3. Verify Vercel preview **READY** for the exact candidate SHA. A prior READY preview of another commit is insufficient.
4. Use the normal reviewed, protected merge and deployment gates. Do not change production aliases ahead of approval.

## Boundaries

These changes do not autonomously author systematic reviews, infer eligibility, or assert that retrieved papers were screened. Provider evidence and model interpretation remain separate. No database migrations or permission policies are changed by this branch.

Vercel previously returned HTTP 402 for daily deployment quota; if this still occurs, treat preview validation as **blocked** rather than passing it by assumption.
