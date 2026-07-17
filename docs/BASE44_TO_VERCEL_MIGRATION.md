# Base44 to Vercel Migration

This branch preserves the existing EYLO interface while replacing Base44 platform dependencies with services that can run independently on Vercel.

## Principles

- Preserve the current UI and user flows.
- Keep every intermediate commit deployable on Vercel.
- Move one backend capability at a time.
- Never expose secrets in the browser bundle.

## Migration sequence

1. Inventory every Base44 SDK import and call.
2. Introduce a provider-neutral service layer under `src/services`.
3. Replace authentication with Supabase Auth.
4. Replace Base44 entities with Supabase PostgreSQL tables.
5. Replace Base44 server functions with Vercel API routes.
6. Replace Base44 file handling with Supabase Storage.
7. Route EYRA and other AI requests through authenticated server endpoints.
8. Add environment validation, error handling, and deployment documentation.
9. Remove Base44 packages and Vite plugin only after all callers have migrated.

## Planned environment variables

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Only variables prefixed with `VITE_` are available to the browser. Service-role and AI keys must remain server-only.

## Definition of done

- The existing EYLO design remains intact.
- Authentication works without Base44.
- User data, projects, settings, research content, and uploads persist outside Base44.
- AI requests run through protected Vercel endpoints.
- Production and preview deployments build successfully.
- `@base44/sdk` and `@base44/vite-plugin` can be removed.
