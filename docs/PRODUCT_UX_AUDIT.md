# Product and UX audit

## Product definition

EYLO AI is an AI-powered research and innovation workspace that helps users turn an idea into structured research, projects, collaborators, opportunities, and actionable outcomes.

Primary workflow:

`Idea → Research → Evidence → Project → Team → Opportunity → Outcome`

## Initial route classification

This is an initial classification based on the current route inventory. Every retained route still requires page-level verification of data source, persistence, interaction, accessibility, mobile behavior, and completion status.

| Route | Classification | Intended action |
| --- | --- | --- |
| `/` | Core | Rebuild as a real-data overview and next-action dashboard. |
| `/ideas` | Core | Retain as idea capture and project conversion. |
| `/library` | Core | Retain for research resources and evidence. |
| `/projects` | Core | Retain for project execution. |
| `/projects/:id` | Core | Retain as project workspace. |
| `/researchers` | Core/Supporting | Reframe as verified people and collaborators. |
| `/opportunities` | Core | Retain for verified opportunities and project associations. |
| `/history` | Supporting | Reframe as activity history. |
| `/profile` | Supporting | Merge user-facing profile controls with settings where appropriate. |
| `/settings` | Supporting | Retain. |
| `/future` | Experimental | Move under `/labs/*` unless substantive behavior is verified. |
| `/futureme` | Experimental | Move under `/labs/*` unless substantive behavior is verified. |
| `/battlefield` | Experimental | Move under `/labs/*` unless substantive behavior is verified. |
| `/dreamteam` | Experimental | Move under `/labs/*` unless substantive behavior is verified. |
| `/impact` | Experimental | Move under `/labs/*`; remove fabricated scoring. |
| `/radar` | Experimental | Merge with Opportunities or move to Labs. |
| `/briefing` | Experimental | Move to Labs unless backed by real data. |
| `/foryou` | Incomplete/Duplicate | Merge into dashboard recommendations. |
| `/challenges` | Supporting/Incomplete | Verify real source or merge into Opportunities. |
| `/meetings` | Supporting/Incomplete | Retain only if scheduling and persistence work. |
| `/pricing` | Misleading/Supporting | Keep only when billing is intentionally implemented. |

## Navigation target

Primary navigation should converge on:

- Overview
- Ideas
- Library
- Projects
- People
- Opportunities
- EYRA
- Labs
- Activity
- Settings

Experimental modules must not compete with the core workflow in primary navigation.
