/**
 * Save an AI-suggested research question as a human-selected candidate.
 * Only owner-scoped Project repositories may persist the result; all cited IDs
 * must resolve to the exact current selected SavedPaper set.
 */
function bounded(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

export function buildSavedGapCandidate(gap, selectedPapers, recordedAt) {
  const question = bounded(gap?.proposed_question || gap?.question, 500);
  if (!question) throw new Error('The selected candidate has no research question.');
  if (!Array.isArray(selectedPapers) || selectedPapers.length < 2) {
    throw new Error('Select at least two authorized saved papers.');
  }
  const refs = new Map(selectedPapers.map((paper, index) => [
    `P${index + 1}`,
    { paper_id: String(paper?.id || ''), title: bounded(paper?.title, 400),
      doi: bounded(paper?.doi, 200), year: paper?.year || null },
  ]));
  if ([...refs.values()].some(paper => !paper.paper_id)) {
    throw new Error('A selected publication has no saved Library identifier.');
  }

  const resolve = (values, label) => {
    if (!Array.isArray(values)) throw new Error(`Invalid ${label} references.`);
    const seen = new Set();
    return values.map(value => {
      const ref = bounded(value, 20);
      if (!refs.has(ref)) throw new Error(`Unverified ${label} paper reference.`);
      const row = refs.get(ref);
      if (seen.has(row.paper_id)) return null;
      seen.add(row.paper_id);
      return { ...row, citation_ref: ref };
    }).filter(Boolean);
  };
  const support = resolve(gap?.supporting_papers, 'supporting');
  const counterevidence = resolve(gap?.counterevidence_papers || [], 'counterevidence');
  if (!support.length) throw new Error('A proposed question needs at least one verified supporting paper.');
  return {
    question,
    explanation: bounded(gap?.explanation, 2000),
    limitations: bounded(gap?.limitations, 2000),
    uncertainty: bounded(gap?.uncertainty, 2000),
    suggested_methodology: bounded(gap?.methodology, 2000),
    supporting_papers: support,
    counterevidence_papers: counterevidence,
    selected_source_ids: [...refs.values()].map(paper => paper.paper_id),
    recorded_at: recordedAt,
    review_status: 'candidate_needs_human_review',
    evidence_scope: 'selected-saved-papers-only',
  };
}

export async function saveResearchGapCandidate({ entities, projectId, gap, selectedPapers, recordedAt }) {
  if (!projectId) throw new Error('Choose an existing research project first.');
  const candidate = buildSavedGapCandidate(gap, selectedPapers, recordedAt);
  const project = await entities.Project.get(projectId);
  if (!project || project.id !== projectId) throw new Error('The selected project is unavailable.');
  const saved = Array.isArray(project.gap_candidates) ? project.gap_candidates : [];
  const key = entry => `${bounded(entry?.question, 500).toLowerCase()}|${(entry?.selected_source_ids || []).slice().sort().join(',')}`;
  if (saved.some(entry => key(entry) === key(candidate))) return { status: 'already_saved', count: saved.length };
  if (saved.length >= 20) throw new Error('This project has reached its 20-candidate review limit.');
  await entities.Project.update(projectId, { gap_candidates: [...saved, candidate] });
  return { status: 'saved', count: saved.length + 1 };
}
