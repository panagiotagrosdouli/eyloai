# EYRA Intelligence Architecture — verified code paths, 2026-11-11

**Scope:** Repository `panagiotagrosdouli/eyloai`. Source review and mocked regression testing only; this is **not** a successful live OpenAI/Supabase or production declaration.

## Authenticated model execution

1. `src/components/eyra/EyraCommandCenter.jsx` collects a user request, optional personalized workspace context and retrieved scholarly records.
2. `src/api/base44Client.js` resolves the legacy `InvokeLLM` facade to `src/lib/eyra-intelligence.js`, **not** to a simulated model.
3. `src/lib/eyra-intelligence.js` obtains a Supabase session via `getUsableSession({required:true, validate:true})` and sends `POST /api/eyra` with a bearer token. On 401 it performs one refresh/retry then invalidates authentication.
4. `api/eyra.js` verifies the token using the configured Supabase `/auth/v1/user`, validates prompt/schema, uses a privileged *server-side* RPC to reserve the user's monthly quota and sends the model request to `https://api.openai.com/v1/responses` with `store:false`. No OpenAI secret is sent to the browser.
5. A completed model result is extracted. Refusal, incomplete output, empty output or malformed response fails explicitly; appropriate model failures attempt to refund reserved usage.
6. With PR #326, even parseable structured JSON must satisfy the supported response schema. Invalid result → HTTP 502 `EYRA_SCHEMA_MISMATCH` and quota release.
7. Independently, PR #328 verifies model-cited `[P#]`, `[R#]`, `[I#]` and `[F#]` identifiers against actually retrieved sources in the conversational UI. **Matching an identifier does not prove that the cited abstract semantically supports a claim.**

## Scientific integrity boundaries

- Scholarly sources are retrieved separately and are not produced by the model. Source URLs, authors, titles and abstracts are untrusted data, not model instructions.
- A citation ID is a reference to a retrieved record, **not** a semantic entailment or evidence-quality assessment.
- The retrieval-based fallback must remain explicitly a set of retrieved records, never presented as a successful AI synthesis.
- Project notes are user-authored and are not automatically verified literature.
- Full text is not necessarily available; the system must not fabricate page-level quotes or claim systematic literature coverage from a limited retrieval sample.
- Deterministic tests and live human-reviewed scientific benchmarks (fabricated references, DOI mismatches, unsupported inferences, contradictory studies) are required before certification.

## Availability and authorization

- `api/capabilities.js` exposes service capability flags, not secrets. PR #329 aligns the AI flag with both Supabase public Auth and server-side usage config; without it a model key + server key could misleadingly show enabled AI despite absent Supabase URL/public key.
- Production readiness requires confirmation that `VITE_SUPABASE_URL`, the public key, the privileged server key, quota RPCs and OpenAI key all target the intended authorized environment.
- No unlocked deployment, different Supabase project or unmetered model fallback is an acceptable workaround.
- Model requests carrying private context must remain opt-in via the existing personalization controls; context minimization requires further browser/data-flow review.

## Tests and evidence

- Existing repository regression tests cover EYRA authentication, quota limits, upstream timeout/cancellation, malformed prompts, model incomplete status, source grounding and fallback paths.
- PR #326 adds `tests/eyra-structured-contract.test.mjs` and `tests/eyra-structured-api.test.mjs` for a structured response mismatch and a mocked quota refund.
- CI for PR #326 head `17b846cd13e42784a4b8182267995057c142e84f`: Build, EYLO Quality Gate and Product quality completed successfully.
- These tests are mocked/deterministic. They do **not** prove the intended Supabase production tenant, actual quota RPC installation, model API authorization, production browser login, or real citations.
- Public production checks previously found `/api/billing` and `/api/opportunities` fail closed with `SUPABASE_NOT_CONFIGURED`; the intended project and Vercel deployment environment remain inaccessible through the connected accounts. Reprobe before making current claims.

## Release blockers (P0)

1. Identify actual Vercel production project/deployed commit and verify environment-variable names, origins and presence without disclosing values.
2. Verify the intended Supabase project (project ID `kbzjngpzxpniaumlupaa`) and installed quota/RLS policies with owner-authorized access.
3. Use two disposable users to prove private project isolation, session recovery and cross-account read/update/delete denial.
4. Verify one real authenticated EYRA model call with a small source-backed request, quota reservation, output validation and downstream project save. **No live paid model call has been executed in this audit.**
5. Validate the source facts and citation support using human-reviewed benchmark fixtures; record false acceptance and false rejection.
6. Review integration of PRs #292, #323–#325, #326, #328 and #329 and re-run all CI/browser/security checks on the consolidated candidate. Do not assume independent green PRs guarantee a green combined release.
7. Obtain review/release-owner approval and verify rollback before production deploy.

## Product scope / future batches

Prioritize question → discovery → saving → evidence review → EYRA → project → export. Literature Review Studio, Campus, Learn, Venture, multi-agent review, source-backed writing and institutional collaboration remain separate feature-development targets; do not label those completed based on the current endpoint.
