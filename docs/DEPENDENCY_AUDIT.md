# Dependency audit

## Confirmed findings

| Package or group | Classification | Current assessment | Repair status |
| --- | --- | --- | --- |
| `@supabase/supabase-js` | Used | Authentication backend and planned data access layer. | Retain. |
| `react`, `react-dom`, `react-router-dom` | Used | Core application and routing. | Retain. |
| `@tanstack/react-query` | Used | Application query cache/provider. | Retain pending page-level review. |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Used/Planned | Required for validated auth and product forms. | Retain and expand usage. |
| `@base44/sdk` | Legacy technical debt | Must be removed after confirming and replacing all runtime imports. | Inventory pending. |
| `@base44/vite-plugin` | Legacy technical debt | Must be removed after Vite configuration and build are verified without it. | Inventory pending. |
| Stripe packages | Experimental/Unverified | Billing is not yet confirmed as a retained product feature. | Verify usage before removal. |
| `three` | Experimental/High bundle cost | Likely tied to prototype visualization. | Verify Labs usage and remove if non-substantive. |
| `react-leaflet` | Experimental/High bundle cost | Retain only for a verified map workflow. | Verify usage. |
| `moment` | Replaceable | Duplicates `date-fns` and increases bundle weight. | Replace where practical, then remove. |
| Toast libraries | Duplicated | Radix toast, React Hot Toast, and Sonner are all present. | Standardize on one implementation. |
| PDF/screenshot packages | Experimental/High bundle cost | `jspdf` and `html2canvas` should remain only for a working export feature. | Verify usage. |
| `react-quill` | Experimental/High bundle cost | Retain only if rich-text editing is part of a completed core workflow. | Verify usage. |
| Carousel packages | Supporting/Unverified | Retain only when required by deliberate UX. | Verify usage. |

## Validation required before removals

- Search every import and dynamic import.
- Confirm Vite build behavior.
- Record bundle contribution.
- Remove only after replacing retained functionality.
- Update lockfile through a clean install.
