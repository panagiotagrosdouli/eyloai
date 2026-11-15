const WORKSPACE_SOURCE_LABELS = Object.freeze({
  projects: 'Recent projects',
  notes: 'Recent notes',
  tasks: "Today's tasks",
  goals: 'Study planner',
  events: 'Calendar',
  decks: 'Flashcards',
  papers: 'Saved research',
  activity: 'Recent activity',
});

/** Return readable section names without exposing backend error details. */
export function describeWorkspaceSourceFailures(failedSources) {
  const uniqueSources = [...new Set(Array.isArray(failedSources) ? failedSources : [])];
  const labels = uniqueSources.map((source) => WORKSPACE_SOURCE_LABELS[source] || 'Another workspace section');
  return labels.length ? labels.join(', ') : '';
}
