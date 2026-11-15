# EYRA tool registry

The active registry is defined in `api/eyra.js`. This page documents only executable tools; proposed future tools are not presented as implemented.

| Tool | Input | Operation | Auth and scope | Side effect | Confirmation |
|---|---|---|---|---|---|
| `project.list` | `{}` | Select up to 50 project rows ordered by most recently updated | Required Supabase user bearer; explicit `user_id` filter plus RLS | Read | Not required |
| `project.get` | Project UUID | Read one project record by ID with owner filter and RLS | Required user bearer; UUID validation; owner-scoped select | Read only | Not required |
| `project.create` | `title`, `description`, `goal`, `milestones`, `tasks` strings | Insert a JSONB project row with `planning` status; verify returned title and UUID | Required Supabase user bearer; row owner is authenticated user; RLS; free-plan single-project check when billing is configured | Persistent create | Explicit create request in the current user prompt |
| `notes.list` | `{}` | List up to 20 private notes with bounded title/content previews | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `tasks.list` | `{}` | List up to 20 private life tasks, statuses, due dates | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `calendar.list_events` | `{}` | List up to 20 private calendar events and displayed timing fields | Supabase user bearer, `user_id` predicate and database RLS | Read only | Not required |
| `research.search_publications` | `query` string (3–180 characters) | Search Crossref bibliographic metadata; return at most five DOI-validated results with `bibliographic_metadata_only` evidence labels | Authenticated EYRA request with tool enablement; no private database operation | Read-only external metadata lookup | Not required |
| `research.lookup_doi` | `doi` string | Fetch and validate publication title, authors, year, journal and canonical DOI from Crossref; mark as bibliographic metadata only | Authenticated EYRA request with explicit tool enablement; no private database operation | Read only; external metadata lookup | Not required || `library.list_papers` | `{}` | Select up to 50 saved paper rows ordered by most recently updated | Required Supabase user bearer; explicit `user_id` predicate plus RLS | Read | Not required |
| `library.save_paper` | `doi`, `title` strings | Verify DOI and normalized title with Crossref; insert Crossref metadata into `saved_papers`; check same-user DOI duplicates first | Required Supabase user bearer; owner ID from authenticated identity and RLS; public Crossref lookup | Persistent create | Explicit request to save the paper |

Creation constraints: title is required and limited to 180 characters; description 4,000; goal 2,000; milestones and tasks 6,000 each. Project rows must contain a string UUID and object-valued `data` on return. Failures are returned to the model as failures and are not success results.

The tools use the Responses API function-call contract with strict JSON schemas. They are added only for callers that set `enable_project_tools: true`. Paper saving requires a Crossref-verifiable DOI/title pair; non-DOI records are not supported. Model-generated abstracts are not stored. Tool timeout is 15 seconds; OpenAI request timeout is 60 seconds. EYRA usage is reserved once per invocation through the existing quota RPC.

Not in the active registry: any update, archive, delete, milestone CRUD, researcher/opportunity save or link, paper/project linking, export, funding action, or external communication. The new notes, tasks, and calendar actions are read-only and return bounded summaries, not full documents.
