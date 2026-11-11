# EYRA workflow tests

## Automated evidence

`tests/eyra-project-tools.test.mjs` covers:

- Explicit create request calls the user-scoped Supabase REST endpoint, sends the authenticated owner ID, and reports only the returned verified UUID.
- A tool call to create a project is rejected when the user asked for advice rather than creation.
- An explicit paper-save request verifies DOI/title against mocked Crossref metadata, writes the saved-paper record, and returns its persisted ID.

Run with:

```bash
node --test tests/eyra-project-tools.test.mjs
```

## Required acceptance tests not yet demonstrated

- Authenticated production project creation and persistence.
- Live RLS isolation using two disposable users.
- Free-plan boundary against the intended billing and Supabase projects.
- Live Crossref verification and authenticated Library persistence and duplicate behavior.
- OpenAI outage before tool use and follow-up failure after a persisted tool result.
- The broader prompt's Library save/link, milestone, funding, citation, contextual route and deployment flows.
- Browser UX and action-status presentation across retries.

Mocked tests are not production evidence. Do not infer live acceptance from the two unit tests.
