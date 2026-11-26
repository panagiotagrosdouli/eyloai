const WORKFLOW_STAGES = [
  { id: 'evidence', label: 'Evidence Matrix', target: 'evidence-matrix-studio-title', field: 'evidence_matrix' },
  { id: 'review', label: 'Literature Review', target: 'literature-review-builder-title', field: 'literature_review' },
  { id: 'proposal', label: 'Research Proposal', target: 'research-proposal-builder-title', field: 'research_proposal' },
  { id: 'methodology', label: 'Methodology', target: 'research-methodology-studio-title', field: 'research_methodology' },
  { id: 'roadmap', label: 'Research Roadmap', target: 'research-roadmap-studio-title', field: null, tracksSavedArtifact: false },
];

function hasSavedValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

export function getResearchWorkflowProgress(project) {
  const stages = WORKFLOW_STAGES.map(stage => {
    const saved = stage.tracksSavedArtifact === false ? false : hasSavedValue(project?.[stage.field]);
    const status = stage.tracksSavedArtifact === false
      ? 'Approval + workplan save required'
      : saved ? 'Saved' : 'Not started';
    return { ...stage, saved, status };
  });
  const trackedStages = stages.filter(stage => stage.tracksSavedArtifact !== false);
  return { stages, savedCount: trackedStages.filter(stage => stage.saved).length, total: trackedStages.length };
}
