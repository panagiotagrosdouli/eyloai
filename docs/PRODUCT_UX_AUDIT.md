# Product and UX audit

_Last reviewed: 2026-09-25._

## Product definition

EYLO connects scholarly discovery to people, funding, and practical next steps. The product should help a researcher move from a question to evidence, expertise, an opportunity, and a project.

Primary workflow:

`Question → Evidence → People → Opportunity → Project → Next move`

EYRA is the reasoning layer over retrieved and saved context. It should not be presented as a replacement for source verification.

## Research and career support

- Public discovery searches scholarly literature and reveals people behind relevant publications.
- The Researchers workspace supports author discovery and local CV-based matching to researchers, supervisors, and labs.
- Funding search returns opportunities with links to official sources.
- CV matching is a fit exploration, not a live job board or a guarantee of employment.
- Academic job listings and calls for papers must not be presented as live until real, traceable sources and update behavior are implemented.

## Navigation model

The primary interface should keep the core research journey visible and place speculative tooling behind an explicit Labs boundary.

### Primary navigation

- Home
- Discover
- People
- Funding
- Projects
- Ask EYRA

### Research and decision tools

- Researchers
- For you / monitored context
- Open challenges
- Executive briefing
- Opportunity review
- Idea workspace
- Grant workspace
- Pitch deck
- Meetings

### Labs

- `/labs/research-landscape`
- `/labs/impact`
- `/labs/scenario`
- `/labs/team`
- `/labs/professional-path`
- `/labs/voice`

Legacy paths such as `/future`, `/impact`, `/battlefield` and `/dreamteam` redirect to the corresponding Labs route.

## UX principles

1. The first screen should answer “what can I do here?” within seconds.
2. Search starts with the user's research question, level, goal and recency preference.
3. Results separate entry-point, recent, foundational and additional records instead of showing a flat paper list.
4. Citation count is context, not a quality score.
5. Model-generated scores and recommendations must be labelled as decision support rather than calibrated predictions.
6. Every AI-heavy route needs loading, empty, partial-source and error states.
7. Saving evidence should visibly connect to Library, Projects and EYRA context.
8. Experimental tools must not compete with the core workflow for primary-navigation attention.
9. Every opportunity needs a real source, working original link, freshness and eligibility context.

## Next UX validation

- Observe first-time users completing a search without instruction.
- Test whether users understand the distinction between source records and EYRA inference.
- Measure search → source-open/save → project conversion rather than raw page views.
- Verify keyboard, small-screen and screen-reader behavior on the core flow before expanding Labs.
