# EYLO 2030 — Authenticated screen source inventory

Static source inspection on 2026-11-15. **Not a logged-in browser or accessibility audit.** Literal markup signals do not prove working behavior or WCAG compliance.

| Component | Heading markup | Forms | Fields | Explicit feedback |
|---|---|---:|---:|---|
| Home | H1 present | 0 | 0 | Review nested components |
| Library | H1 present | 0 | 2 | status, alert |
| Projects | H1 present | 0 | 5 | status, alert |
| EyloFiles | H1 present | 0 | 4 | status, alert |
| Notes | H1 present | 2 | 5 | status, alert |
| Learn | H1 present | 1 | 10 | alert |
| StudyPlanner | H1 present | 1 | 10 | status, alert |
| Calendar | H1 present | 1 | 8 | status, alert |
| ResearchGaps | H1 present | 1 | 3 | status, alert |
| LiteratureReview | H1 present | 0 | 7 | status, alert |
| ResearchDataLab | H1 present | 0 | 4 | status, alert |
| ResearchKnowledgeGraph | H1 present | 0 | 2 | status, alert |
| Opportunities | H1 present | 1 | 4 | status, alert |
| Researchers | H1 present | 1 | 5 | status, alert |
| Meetings | H1 present | 0 | 1 | alert |
| GrantBuilder | H1 present | 0 | 4 | status |
| QuizGenerator | H1 present | 2 | 12 | alert |
| Flashcards | H1 present | 1 | 6 | status, alert |
| TimeTracker | H1 present | 2 | 10 | status, alert |
| Life | H1 present | 1 | 13 | status, alert |
| LifeGoals | H1 present | 1 | 8 | status, alert |
| Habits | H1 present | 1 | 4 | status, alert |
| History | H1 present | 0 | 1 | status |
| ActivityHistory | H1 present | 0 | 0 | status, alert |
| ProductTools | H1 present | 0 | 2 | status, alert |
| ProductWorkbench | Check nested headings | 1 | 6 | Review nested components |
| CollaborationTools | H1 present | 0 | 12 | status, alert |
| ProjectDetail | Check nested headings | 0 | 21 | status, alert |
| ProjectResearchRecords | H1 present | 1 | 7 | status, alert |
| ProjectDecisions | H1 present | 1 | 11 | status, alert |
| ThesisStudio | Check nested headings | 1 | 7 | status, alert |
| ResearchBudget | Check nested headings | 1 | 8 | Review nested components |
| ForYou | H1 present | 0 | 0 | status |
| IdeaVault | H1 present | 0 | 4 | status, alert |
| OpportunityRadar | H1 present | 0 | 1 | status, alert |
| ExecutiveBriefing | H1 present | 0 | 0 | Review nested components |
| FutureSimulator | H1 present | 1 | 1 | alert |
| FutureMe | Check nested headings | 0 | 0 | Review nested components |
| ResearchBattlefield | H1 present | 1 | 1 | status, alert |
| DreamTeam | H1 present | 1 | 2 | alert |
| ImpactPredictor | H1 present | 1 | 1 | alert |
| VoiceAssistant | H1 present | 1 | 1 | Review nested components |
| PitchDeckBuilder | H1 present | 1 | 3 | Review nested components |
| InstitutionAdmin | H1 present | 0 | 0 | Review nested components |
| Profile | H1 present | 0 | 2 | status |
| Settings | H1 present | 0 | 1 | Review nested components |
| Notifications | H1 present | 0 | 0 | Review nested components |
| Challenges | H1 present | 0 | 1 | status, alert |
| src/pages/PublicCareers.jsx | Check nested headings | 0 | 0 | Review nested components |
| src/pages/OfflineWorkspace.jsx | H1 present | 0 | 2 | status, alert |
| src/pages/DocumentEditor.jsx | H1 present | 0 | 3 | status, alert |
| src/pages/Pricing.jsx | H1 present | 0 | 0 | status |
| src/pages/AccountDeletion.jsx | H1 present | 2 | 4 | status, alert |
| src/components/products/PersonalTools.jsx | H1 present | 0 | 11 | status, alert |
| src/components/eyra/EyraCommandCenter.jsx | Check nested headings | 0 | 3 | status, alert |
| src/components/layout/AppLayout.jsx | Check nested headings | 0 | 2 | alert |

## Interpretation and outstanding validation

This inventory covers core route components and the shared EYRA/layout shells. Counts are **literal JSX tags in the selected files only**; nested components may supply headings, inputs, errors and states. A missing literal is a review prompt, not a confirmed accessibility failure.

- **Not executed:** authenticated browser audit, first-time pilot sessions, viewport screenshots, axe scans, Lighthouse and end-to-end workflows against real data.
- **Required before merge:** `npm run check`, route regression suite, browser screenshots at 320/390/768/1024/1440 in both themes, keyboard/EYRA testing and paper-to-library-to-project/funding/study task trials.
- **Targets not achieved by assumption:** action within 30 seconds, three interactions to start common workflows, and 90% unassisted pilot completion. Measure these explicitly.
