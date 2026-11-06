# EYLOAI release acceptance — verified preflight snapshot, 2026-11-06

**Decision: NO-GO.** This is a read-only preflight using available connector
metadata and repository source, not a production certification. Do not
interpret green CI, a ready Preview, connected Stripe, or a publicly
reachable website as evidence that security, research validity, payments
or privacy are production-ready.

## Verified observations

- The production Vercel deployment is READY on Git commit
  `d7db2952796bf046e318cc720042056f5c7f92ce` (`main`, PR #202).
- The integrated candidate is a **draft PR #203**, not deployed to the
  production domain. Source PRs #197–#201 are also draft.
- Vercel environment variable **names** returned by the project metadata
  are only `OPENAI_MODEL`, `OPENAI_API_KEY`,
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  This metadata does **not** reveal or establish the correctness of values.
- The repository's intended production Supabase ref is
  `kbzjngpzxpniaumlupaa`. The only project accessible through the current
  connected Supabase workspace is an **unrelated inactive project**
  `umzrggayitzfgrrofjnw`; it must not be queried, migrated or modified.
- Stripe's connected account list contains an EYLOAI account in
  **livemode**. This is an account-access observation, not proof of
  a functional checkout, signed webhook or entitlement update. **No
  payment, subscription or paid evaluation was initiated.**
- `api/billing.js` requires `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`,
  `STRIPE_FOUNDER_PRICE_ID`, and a server-side Supabase key before
  charging customers. Billing and monitoring have not been enabled.
- `docs/ACCOUNT_DELETION_IMPLEMENTATION_PLAN.md` explicitly states
  account deletion is a **design only**, not an implemented flow.
- No real, independently human-adjudicated EYRA scientific evaluation
  dataset has been collected and accepted. Synthetic unit tests cannot
  establish real-world scientific accuracy.

## Static release inventory

`npm run audit:release -- --snapshot /private/path/read-only-snapshot.json`
evaluates release-blocker presence using only read-only metadata **key
names**, commit SHAs, accessible project refs and **evidence declarations**.
It never connects to Supabase, Stripe, Vercel or OpenAI. The tool never
prints or requires secrets and **never returns a deployment GO decision**;
even a complete self-reported evidence inventory requires independent
final approval.

The separate gates remain unverified until responsible owners supply
documented, independently checked evidence:

1. Verify and authorize access to the correct Supabase project, inspect
   deployed migration history and security advisors, and test actual
   two-user RLS plus workspace export with disposable accounts.
2. Create/review a **new** corrective Analytics SQL migration against
   a verified staging database. Never attempt it on the unrelated project.
3. Complete independent human EYRA study with pre-adjudicated papers,
   external reviewers, domain-specific false-acceptance intervals and
   version-locked model settings. Do not invent study labels.
4. Implement account deletion and jurisdiction-specific retention,
   backup and data subject request procedures. Obtain privacy/legal review.
5. Configure **test/sandbox** Stripe credentials first, verify Checkout,
   portal, renewal, failed payments, cancellations and idempotent webhook
   reconciliation without charging real customers; set production values
   only after explicit approval.
6. Verify monitored cron and usage quota against production-like test
   accounts and spending limits, ensuring any missing server key fails closed.
7. Complete security, incident response, mobile/accessibility and
   recovery acceptance; review dependency-update PRs #204 and #205
   separately rather than auto-merging major dependency changes.
8. Only after signoffs, review and merge the correct PR commit;
   promote to production with rollback readiness and re-run launch
   smoke tests using the exact deployed SHA.

**No release promotion, production data writes, secrets, charges,
human judgement fabrication or live AI evaluation were performed.**
