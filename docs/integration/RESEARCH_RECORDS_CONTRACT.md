# Project research records — batch 7

Research Journal (66), Experiment Lab (60), and Publication Tracker (69) share the existing owner-scoped `projects.data` contract. They introduce no schema, AI memory store or parallel Notes table. An authorized exact project opens `/projects/:id/research/journal`, `/experiments` or `/publications` under that research path. Links appear in Project Detail. Unknown workspaces and missing/foreign projects fail closed.

| Product | Record fields and behavior | Remaining scope |
| --- | --- | --- |
| Research Journal | Dated observation, interpretation/uncertainty, next step, optional source/deadline, recorded/follow-up/resolved status | Hosted acceptance, user review; editable records are not an immutable lab notebook |
| Experiment Lab | Hypothesis, method/analysis plan, observed result, limitations/deviations, source/deadline and planned/running/completed/stopped status; completed requires a result | Hosted acceptance; no analysis engine, experiment execution, participant records or reproducibility certification |
| Publication Tracker | Venue, supplied submission reference/DOI, next action, decision/revision notes, source/deadline; draft/submitted/revision/accepted/published/withdrawn/rejected status | Hosted acceptance, reminder delivery, publisher integration; all statuses are self-reported |

Each workspace supports 100 records and 256 KiB of UTF-8 JSON. Real calendar dates, unique UUIDs, version1, bounded required fields and HTTPS sources without credentials are checked. Unsupported, duplicate or over-budget stored records block writes/exports instead of being dropped. Validation is in the application; the existing database policies enforce project ownership, not field-level scientific semantics. Do not enter participant identifiers or sensitive participant data.

Explicit Save uses the existing project `updated_date` compare-and-set. A conflict leaves the draft visible; reload keeps it while loading the latest saved list for review before another explicit Save. Unknown project data and unknown record metadata are preserved. No AI call or background write occurs. New/edit/cancel ask before discarding an open draft; browser unload warns. In-app navigation elsewhere can discard an unsaved draft; no autosave or encrypted draft recovery is claimed. Protected routes remount on account changes and this workspace remounts on project/workspace changes.

Deletion requires confirmation and uses the same owner/version write. Saved records can be searched by title/status and exported as a private JSON snapshot with supplied sources and uncertainty disclosure. Export excludes unsaved drafts and is not an audit trail. The existing portable workspace export also includes these records within projects.

Acceptance executed locally: meaningful domain tests, actual React/browser forms using isolated Auth/PostgREST transport, mobile390px/desktop, and real disposable PostgreSQL owner/outsider/CAS checks. Synthetic identities and fixtures do not verify hosted Supabase Auth/RLS/PostgREST. No remote migration, production data write, deployment, provider charge or live payment is involved.
