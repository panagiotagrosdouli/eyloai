# EYRA durable ledger activation — isolated staging only

The agent ledger endpoints use a server-owned Supabase key and can write or delete run/action records. Enabling them on the wrong hosted database is unsafe even when the bearer token belongs to a legitimate user.

This candidate tightens `durableRunsEnabled()`:

1. `EYRA_DURABLE_RUNS_ENABLED=true` is necessary but **not sufficient**.
2. `EYLO_ENVIRONMENT=staging`, `EYLO_STAGING_SUPABASE_REF` and `EYLO_STAGING_CONFIRMED_REF` must explicitly identify the same 20-character Supabase project encoded by the HTTPS `VITE_SUPABASE_URL`.
3. The known EYLO production project `kbzjngpzxpniaumlupaa` and unrelated historical project `umzrggayitzfgrrofjnw` cannot activate this experimental agent ledger even if labels and keys are accidentally copied.
4. Both publishable/anonymous and service-key configuration must be present; the secure `/api/eyra-runs` handler returns HTTP 503 **before fetching Auth or touching the database** when the gate fails.
5. The exact same gate is used by `/api/eyra` for run-id initialization and by `/api/eyra-runs` for list, cancel, review and delete. No OpenAI or external provider call is required to validate the gate.

This is a **configuration identity gate, not independent attestation** that the isolated staging project exists, belongs to EYLO, or passes RLS and migration tests. Before changing any stage environment variables, owner must confirm the isolated staging project ID and preview environment, migrations must be reviewed, two disposable authenticated users must pass cross-account denial checks, and canonical migration history must match source.

Existing ledger tests use fabricated stage refs; the new tests explicitly attempt production, mismatched refs, missing credentials and untrusted hostnames. None access a hosted Supabase project.

**Do not merge, enable or promote** this candidate without review and explicit approval. Production agent ledger remains disabled until a distinct release decision and dedicated production security acceptance.
