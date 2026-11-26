const WORKFLOW_STAGES = [
  { id: 'evidence', label: 'Evidence Matrix', target: 'evidence-matrix-studio-title', field: 'evidence_matrix' },
  { id: 'review', label: 'Literature Review', target: 'literature-review-builder-title', field: 'literature_review' },
  { id: 'proposal', label: 'Research Proposal', target: 'research-proposal-builder-title', field: 'research_proposal' },
  { id: 'methodology', label: 'Methodology', target: 'research-methodology-studio-title', field: 'research_methodology' },
  { id: 'roadmap', label: 'Research Roadmap', target: 'research-roadmap-studio-title', field: 'plan_items' },
];

function hasSavedValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

export function getResearchWorkflowProgress(project) {
  const stages = WORKFLOW_STAGES.map(stage => {
    const saved = hasSavedValue(project?.[stage.field]);
    return { ...stage, saved, status: saved ? (stage.id === 'roadmap' ? 'Plan saved' : 'Saved') : 'Not started' };
  });
  return { stages, savedCount: stages.filter(stage => stage.saved).length, total: stages.length };
}
