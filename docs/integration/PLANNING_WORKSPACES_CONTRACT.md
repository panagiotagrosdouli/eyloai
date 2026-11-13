# Research Budget and Thesis Studio — batch8

Both workspaces are private, project-owned documents stored in the existing projects.data contract. They add no tables, remote migrations, writing store or AI memory database. Project Detail links to `/projects/:id/budget` and `/projects/:id/thesis`; both require the existing authenticated route and owner-filtered Project facade.

## Research Budget (70)

`research_budget` stores version1, one supported two-decimal currency, allocated amount and at most 100 expense lines. Each expense has title, category, planned/actual amounts, status and notes. Supported currencies: EUR/USD/GBP/CHF/CAD/AUD. No foreign-exchange conversion, banking connection or payment is performed.

Amounts are nonnegative decimal strings, maximum 999999999.99 each. Parsing produces exact integer minor units; totals are within safe integer bounds. Active line totals show planned, actual, remaining allocation and plan less actual, with category comparisons. Negative remaining allocation means overspend. Cancelled lines must have zero actual cost and are excluded from totals. Currency changes are blocked while saved lines exist; remove and save first rather than silently relabel recorded costs.

Applying a line changes only the in-memory draft. Explicit Save persists the whole budget with project CAS. An open unapplied line disables Save and triggers the unload warning. Removal requires confirmation, changes the draft, and must be saved separately. Saved JSON includes totals/disclosure; saved CSV quotes cells, protects formula prefixes and retains exact decimal formatting. Exports exclude unsaved changes.

## Thesis Studio (59)

`thesis_outline` stores version1, thesis title and at most 50 ordered chapters. Each chapter has title, target words 0–100000, user-reported status, guidance and an optional canonical Note ID. Each note can appear once; no note content is copied into project storage. PostgreSQL UUIDs are accepted without imposing a UUID-generation version on pre-existing note identities.

Only unassigned notes and notes linked to this project are eligible. Up to 1000 recent owner-scoped Notes are offered for selection. Existing chapter references are independently fetched by exact owner-filtered ID, including those beyond the recent cap. Canonical Notes deep links now fetch an authorized exact ID when absent from the recent list; a missing/foreign target clears the old editor and reports failure instead of selecting another note.

Word counts are whitespace-based counts of saved canonical content, not semantic analysis. A complete chapter requires a linked, accessible, nonempty saved Note. Missing/invalid/cross-project sources produce incomplete progress and block save/compile. Every Save and compile re-reads exact sources. Notes can change independently after validation; there is no cross-document transaction or pinned historic-note-version guarantee. Explicit refresh displays saved content; unsaved Note-editor changes are not included.

Chapters can be reordered and removed with confirmation. Removing a chapter does not delete its Note. Markdown compile follows the saved chapter order, includes note IDs/update timestamps and authored content, and discloses unverified citations/status. Saved JSON contains the outline and linked canonical Note snapshots at export time. These are private drafts, not academic acceptance, citation certification or final DOCX/PDF typesetting.

## Persistence and limits

Both documents have a 256 KiB UTF-8 JSON cap. Domain validation is application-side; the existing database policies enforce project/Note ownership, not budget arithmetic or chapter semantics against arbitrary direct API writes. Malformed stored data fails closed.

Explicit Save uses the existing project updated_date compare-and-set. On conflict the local draft is retained, further editing/saving is blocked, and the latest project can be loaded for a side-by-side comparison. A user must choose their draft for review or confirm discarding it for the saved version. Another explicit Save is still required; unrelated project fields are preserved by the canonical facade. There is no automatic merge of conflicting documents.

Account/project changes remount these editors. Unsaved document/sub-editor changes warn before browser unload and the Back-to-project link; arbitrary in-app navigation can still discard unsaved edits. No autosave, offline persistence or immutable history is claimed. Both documents are included in the existing workspace JSON export through projects.

Local evidence comprises domain regressions, actual React forms against synthetic Auth/PostgREST, 390px viewport assertions/screenshots, and disposable PostgreSQL ownership/CAS/linked-Note checks. Hosted Supabase Auth/PostgREST/RLS, deployed schema/provider acceptance and full product completion remain unverified.
