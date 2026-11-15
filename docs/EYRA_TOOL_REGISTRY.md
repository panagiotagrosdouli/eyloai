# EYRA tool registry

The active registry is defined in `api/eyra.js`. This page documents only executable tools; proposed future tools are not presented as implemented.

| Tool | Input | Operation | Auth and scope | Side effect | Confirmation |
|---|---|---|---|---|---|
| `project.list` | `{}` | Return up to 50 bounded project metadata summaries, ordered by most recently updated | Required Supabase user bearer; explicit `user_id` filter plus RLS | Read | Not required |
| `project.get` | Project UUID | Read one project record by ID with owner filter and RLS | Required user bearer; UUID validation; owner-scoped select | Read only | Not required |
| `project.create` | `title`, `description`, `goal`, `milestones`, `tasks` strings | Insert a JSONB project row with `planning` status; verify returned title and UUID | Required Supabase user bearer; row owner is authenticated user; RLS; free-plan single-project check when billing is configured | Persistent create | Latest-turn create request AND explicit user write confirmation |
| `notes.list` | `{}` | List up to 20 private notes with bounded title/content previews | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `tasks.list` | `{}` | List up to 20 private life tasks, statuses, due dates | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `calendar.list_events` | `{}` | List up to 20 private calendar events and displayed timing fields | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `learning.list_flashcard_decks` | `{}` | List up to 20 saved private flashcard decks as bounded metadata | User bearer; explicit owner predicate plus RLS | Read only | Not required |
| `learning.list_lessons` | `course_id` UUID | Read up to 30 lesson titles, objectives, positions and assessment-presence flags for a separately verified owned course; no lesson full text | Validated bearer, user filter, owned course check and RLS | Read only | Not required |
| `learning.list_progress` | `course_id` UUID | Read up to 30 lesson completion statuses for a separately verified owned course; no quiz answers, grades or grader details | Validated bearer, user filter, owned course check and RLS | Read only | Not required |
| `learning.list_courses` | `{}` | Read up to 20 owner-scoped courses from the canonical scalar `learning_courses` table, bounded title/subject/description only | Bearer JWT, `user_id` predicate and RLS | Read only | Not required |
| `learning.list_quizzes` | `{}` | Read up to 20 owner-scoped quiz metadata rows from canonical `quizzes` table, no questions or grades | Bearer JWT, owner predicate and RLS | Read only | Not required |
| `notes.search` | `query` (3–120 characters) | Search up to 100 recent owner-scoped note rows and return up to 10 matching titles/300-character previews; **not a complete corpus search** | Bearer JWT, owner predicate and RLS | Read only | Not required |
| `library.search_papers` | `query` (3–120 characters) | Search up to 100 recent owner-scoped saved paper rows by title, authors or DOI; return up to 10 metadata records, **not full text** | Bearer JWT, owner predicate and RLS | Read only | Not required |
| `funding.list_saved_opportunities` | `{}` | List up to 20 saved grant/opportunity records, marked not live-eligibility verified | User bearer; explicit owner predicate plus RLS | Read only | Not required |
| `research.list_saved_researchers` | `{}` | List up to 20 saved researcher records, marked not live-affiliation verified | User bearer; explicit owner predicate plus RLS | Read only | Not required |
| `research.search_publications` | `query` string (3–180 characters) | Search Crossref bibliographic metadata; return at most five DOI-validated results with `bibliographic_metadata_only` evidence labels | Authenticated EYRA request with tool enablement; no private database operation | Read-only external metadata lookup | Not required |
| `research.lookup_doi` | `doi` string | Fetch and validate publication title, authors, year, journal and canonical DOI from Crossref; mark as bibliographic metadata only | Authenticated EYRA request with explicit tool enablement; no private database operation | Read only; external metadata lookup | Not required |
| `library.list_papers` | `{}` | Return up to 50 bounded saved-paper bibliographic summaries ordered by most recently updated | Required Supabase user bearer; explicit `user_id` predicate plus RLS | Read | Not required |
| `library.save_paper` | `doi`, `title` strings | Verify DOI and normalized title with Crossref; insert Crossref metadata into `saved_papers`; check same-user DOI duplicates first | Required Supabase user bearer; owner ID from authenticated identity and RLS; public Crossref lookup | Persistent create | Latest-turn save request AND explicit user write confirmation |

Creation constraints: title is required and limited to 180 characters; description 4,000; goal 2,000; milestones and tasks 6,000 each. Project rows must contain a string UUID and object-valued `data` on return. Failures are returned to the model as failures and are not success results.

The tools use the Responses API function-call contract with strict JSON schemas. They are added only for callers that set `enable_project_tools: true`. Paper saving requires a Crossref-verifiable DOI/title pair; non-DOI records are not supported. Model-generated abstracts are not stored. Tool timeout is 15 seconds; OpenAI request timeout is 60 seconds. EYRA usage is reserved once per invocation through the existing quota RPC.

Not in the active registry: any update, archive, delete, milestone CRUD, researcher/opportunity save or link, paper/project linking, export, funding action, or external communication. The new notes, tasks, and calendar actions are read-only and return bounded summaries, not full documents.

## Contextual and output UX

The active project route may provide a validated `resource_context` object to `/api/eyra`. The backend fetches owner-scoped records; the UI never supplies source content as privileged context. Tool actions are presented with truthfully labeled counts and metadata/full-text limitations rather than a generic success statement.

All tool arguments are checked server-side against the allowlisted function schema. The separate `latest_user_request` must match the last Command Center turn; earlier dialogue and `tool_intent` cannot authorize writes. `write_confirmed: true` must also be supplied to execute an explicit project or DOI-paper save. The UI shows review/edit/cancel/confirm of the user's request; this is not a preview of exact model-selected fields. Durable cross-request idempotency and transaction-level previews remain unimplemented.

The additional learning read tools use verified scalar fields (`title`, `subject`, `description`, `updated_at`), not the JSONB `data` shape used by other workspace tables. This distinction was checked against the connected hosted Supabase schema. Matching text in notes and papers is restricted to a recent 100-row window and the output explicitly names the limited scope; negative results are not proof that a record does not exist elsewhere.
