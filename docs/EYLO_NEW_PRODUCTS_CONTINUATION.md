# EYLO New Products Continuation

Session handoff: 2026-11-12 (Europe/Athens)

## Repository state

- Repository: `panagiotagrosdouli/eyloai`, working branch `codex/eylo-notes-calendar-study`.
- Latest upstream main inspected: `78b6c041cb4bfe28b3febf7e640742d6f49993e0`.
- Draft PR #391: https://github.com/panagiotagrosdouli/eyloai/pull/391. It includes Notes, Calendar, Study Planner, Life, Time Tracker, Flashcards and Quiz Generator. Current pushed PR head is `2ba45ee3c635428017315294d66184e4acb63e05`. Vercel status is failed because the project is on Hobby and the configured hourly cron exceeds its daily-cron allowance. Do not claim the reminders are timely or merge/deploy until an authorized supported scheduler is configured.
- No production database or production deployment was modified. Supabase credentials are placeholders; no staging user accounts were available.
- The tracker lists all 77 products and marks no product production-ready.

## Product workflows implemented locally

1. **EYLO Notes** (`/notes`): owner-scoped notebooks and notes, Markdown edit/preview, tags/search, autosave, version snapshots, delete, and Markdown export. Migration: `supabase/migrations/20261112090000_eylo_notes.sql`.
2. **EYLO Calendar** (`/calendar`): persisted events/deadlines, projects, time zones, recurrence, reminder preferences; notifications are dispatched by an authenticated hourly cron through an atomic idempotent DB worker. Migration: `supabase/migrations/20261112100000_eylo_calendar.sql`; endpoint `api/calendar-reminders.js`.
3. **EYLO Study Planner** (`/study-planner`): study sessions/exams stored as the same Calendar records; completion status stays synchronized.
4. **EYLO Life** (`/life`): goals, tasks, habits/check-ins, routines, milestones, progress and server-side AI daily suggestions that only create tasks after human selection. Task/milestone deadlines sync to Calendar by DB trigger. Migration: `supabase/migrations/20261112120000_eylo_life.sql`.
5. **EYLO Time Tracker** (`/time-tracker`): persistent single-running timer, manual time entry, project/Life task links, today/week/project summaries, delete and paginated all-record CSV export. Migration: `supabase/migrations/20261112130000_eylo_time_tracker.sql`; tests in `tests/time-tracker-data.test.mjs`; staging script `tests/e2e-time-tracker.mjs`.
6. **EYLO Flashcards** (`/flashcards`): owner-scoped decks and cards, optional Note links, server-side atomic spaced-repetition updates, persisted review history and card/deck lifecycle. Migration: `supabase/migrations/20261112140000_eylo_flashcards.sql`; staging script `tests/e2e-flashcards.mjs`.
7. **EYLO Quiz Generator** (`/quiz-generator`): consent-based EYRA question generation, validated preview, atomic quiz/question persistence, database-graded attempts, saved result feedback/history and deletion. Migration: `supabase/migrations/20261112150000_eylo_quizzes.sql`; staging script `tests/e2e-quiz-generator.mjs`.

All seven workflows remain **IN_PROGRESS**, not production-ready. Migration application, Supabase RLS/backend CRUD, two-user isolation, live provider behavior, authenticated browser tests and deployment verification are still required.

## Checks and evidence

- Full `npm run check` passed with Quiz Generator included: import check, both TypeScript checks, ESLint, 482 tests, and production build. The build emits existing dependency annotation, chunk-size, and Supabase chunking warnings.
- `node --check` passed for the Calendar, Time Tracker, Flashcards, and Quiz Generator staging Playwright scripts. Hosted browser tests have not run; use only an approved non-production staging URL, allowed host, credentials, and `EYLO_E2E_CONFIRM_DATA_MUTATION=YES`.
- Existing `tests/e2e-calendar.mjs` and `npm run test:e2e:calendar` cover Calendar/Study Planner/Life cross-workflow and two-account isolation; not run without two staging accounts.
- No live Supabase integration or browser E2E was run. Vite build reports existing warning messages about chunk size, dependency annotations and Supabase chunking.

## External blockers

- `.env.example` contains placeholders. Do not infer or write to a Supabase project. Apply migrations only after the explicitly authorized EYLO staging project is configured.
- Git CLI push has no credentials; the connected GitHub integration has updated the existing draft PR for committed slices.
- Vercel check is currently failed and no preview deployment is available. Confirm the failure cause and require a real preview before merge/deploy.
- No two test accounts or approved staging target were provided, so RLS isolation and actual hosted browser workflows remain unverified.

## Next implementation sequence

1. Continue with EYLO Learn using actual course/lesson/assessment records and connect saved quiz progress.
2. Continue sequentially through the remaining backlog without exposing unfinished routes as complete.
3. Once staging is explicitly configured: apply migrations in order, run two-user RLS and all E2E workflows, verify actual AI and reminder provider behavior, and update every affected tracker row with evidence.

## Relevant files

- Notes: `src/pages/Notes.jsx`, `src/lib/notes-data.mjs`, `supabase/migrations/20261112090000_eylo_notes.sql`, `tests/notes-data.test.mjs`.
- Calendar/Study Planner: `src/pages/Calendar.jsx`, `src/pages/StudyPlanner.jsx`, `src/lib/calendar-data.mjs`, `api/calendar-reminders.js`, `supabase/migrations/20261112100000_eylo_calendar.sql`, `tests/e2e-calendar.mjs`.
- Life: `src/pages/Life.jsx`, `src/lib/life-data.mjs`, `supabase/migrations/20261112120000_eylo_life.sql`, `tests/life-data.test.mjs`.
- Time Tracker: `src/pages/TimeTracker.jsx`, `src/lib/time-tracker-data.mjs`, `supabase/migrations/20261112130000_eylo_time_tracker.sql`, `tests/time-tracker-data.test.mjs`, `tests/e2e-time-tracker.mjs`.
- Flashcards: `src/pages/Flashcards.jsx`, `src/lib/flashcards-data.mjs`, `supabase/migrations/20261112140000_eylo_flashcards.sql`, `tests/flashcards-data.test.mjs`, `tests/e2e-flashcards.mjs`.
- Quiz Generator: `src/pages/QuizGenerator.jsx`, `src/lib/quiz-data.mjs`, `supabase/migrations/20261112150000_eylo_quizzes.sql`, `tests/quiz-data.test.mjs`, `tests/e2e-quiz-generator.mjs`.
- Shared routes/nav: `src/App.jsx`, `src/components/layout/AppLayout.jsx`.
- Global tracker: `docs/EYLO_NEW_PRODUCTS_MASTER_TRACKER.md`.
