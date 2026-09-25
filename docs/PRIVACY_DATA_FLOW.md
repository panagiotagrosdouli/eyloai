# EYLO data-flow and privacy notes

This document describes the current technical data flow. It is engineering documentation, not a substitute for a jurisdiction-specific privacy policy or legal review.

## Public discovery

A public research query can be sent to scholarly metadata providers used by EYLO, including OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar. Returned records are normalized and ranked for discovery.

Do not treat a public discovery query as private workspace data.

## Authenticated workspace

Authenticated users can save projects, ideas, papers, researchers, opportunities, meetings, search history, watchlists and related workspace records in Supabase. User-owned rows are expected to be scoped by row-level security to the authenticated user.

## EYRA

EYRA requests can include the user's prompt plus selected research or project context required for the requested analysis. Model output is inference and must remain distinguishable from source-backed evidence.

The application should minimize the amount of workspace context sent for each AI request and must never send secret keys or unrelated user records.

## Billing

Stripe-hosted checkout and billing portal flows use server-side Stripe credentials. EYLO stores server-controlled entitlement state used to gate paid capabilities. Browser clients must not determine their own paid entitlement.

## Analytics

Product analytics must avoid raw research queries, paper abstracts, project text, email addresses, access tokens and other sensitive free-text content. Events should use coarse, structured product signals wherever possible.

## Retention and deletion

Production policy should explicitly define retention and deletion behavior for:

- authenticated workspace records,
- AI request logs if any,
- server/application logs,
- analytics events,
- Stripe-related identifiers,
- scheduled monitoring records.

Any public-facing privacy policy should be reviewed against the behavior of the deployed application rather than copied from this engineering document.
