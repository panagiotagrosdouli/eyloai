# Time Tracker pause/resume acceptance

## Change and dependency

`20261115181809_time_tracker_pause_resume.sql` is additive. Existing entries receive an empty pause history and revision zero. It adds validated, ordered pause intervals and an owner-scoped `SECURITY INVOKER` RPC for pause/resume/stop. The existing one-active-timer partial unique index includes paused timers. Row locking plus expected revision prevents overlapping tab updates from replacing each other. Same-state requests with a current revision leave data unchanged. Retrying an old revision requires reloading the persisted result; it does not append another pause.

Stopped entries close any open pause atomically. Daily, weekly, project and total duration calculations subtract pause overlap in UTC after local report boundaries are determined. The all-entry CSV includes pause history and net duration. Inclusive local-date reports and their CSV clip net work to exact UTC boundaries and show totals by project. A 23-hour Athens DST-day regression verifies boundary calculations. Reports advance their clock while paused, including across midnight. A timer supports at most 1,000 recorded pauses; stopping remains available when that limit is reached.

The browser requires the RPC for stop as well as pause/resume. Missing migration errors are shown explicitly, without announcing a successful transition. Apply only to the independently confirmed EYLO staging project after hosted schema/history reconciliation; do not push the legacy migration directory wholesale. The checked-in manifest authorizes disposable local replay only.

## Local validation

- Node tests cover paused/completed durations, cross-day/week pause clipping, malformed/overlapping history, RPC revisions, foreign/unconfirmed replies, unavailable migration, and clock skew.
- PostgreSQL tests execute actual migration/RLS/RPC code with two user identities and anonymous denial, reject stale revisions and malformed history, preserve the active-slot constraint while paused, and stop paused timers atomically.
- Three independent-session race rounds require exactly one successful pause and one SQLSTATE 40001 stale revision rejection, with exactly one saved interval.
- Browser fixtures exercise failed-pause retry, pause → reload → resume → pause → reload → stop, and verify persisted state. They are not hosted Supabase or multi-device proof.

Latest command outcomes are recorded in FULL_PLATFORM_IMPLEMENTATION_TRACKER.md after execution. Do not mark the module staging verified from these tests.

## Hosted acceptance still required

Confirm project ownership and a separate staging environment; reconcile migration history; review database advisors; apply the reviewed migration in staging. With two authorized accounts, verify PostgREST RPC shape, pause/resume/stop across reload and a second browser, owner isolation and simultaneous-tab conflict recovery. Exercise DST, midnight, interrupted requests, expired sessions, and the 1,000-pause boundary. Compare database pause timestamps and exported net durations. Record actual deployment/migration identities and test outcomes before promotion.

## Rollback procedure

Before staging writes pause metadata, the additive schema can remain in place while reverting the application; empty histories preserve legacy behavior. Do not remove columns or discard intervals.

After any pause history is written, reverting to the earlier duration calculation overcounts elapsed work, and earlier direct-stop writes cannot close an open pause. Keep the new calculation/export and stop RPC available. If a defect requires suspending pause/resume, disable those two controls in a reviewed application patch while retaining stop and read/export functionality; let owners stop paused entries through the RPC. Forward-fix the transition or validator after reproducing the failure locally. Preserve the pause history and revisions throughout. Any destructive rollback needs a separate reviewed data-preservation migration and explicit authorization; none is supplied or authorized here.
