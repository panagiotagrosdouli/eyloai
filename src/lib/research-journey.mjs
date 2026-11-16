// This read-only map describes recorded workspace evidence, not scientific quality.
// Never infer that an article, screening decision, or thesis has been independently verified.
export const researchJourneyLinks = projectId => {
  const id = encodeURIComponent(String(projectId || ''));
  return {
    project: '/projects/' + id,
    discover: '/search',
    library: '/library?project_id=' + id,
    gaps: '/research-gaps?project_id=' + id,
    review: '/literature-review?project_id=' + id,
    thesis: '/projects/' + id + '/thesis',
    notes: '/notes',
    study: '/study-planner',
  };
};

export function buildResearchJourney(project, { linkedPapers = null, papersLoaded = false, paperLimit = 100 } = {}) {
  if (!project || !project.id) return [];
  const links = researchJourneyLinks(project.id);
  const papers = Number.isInteger(linkedPapers) && linkedPapers >= 0 && papersLoaded ? linkedPapers : null;
  const capped = papers !== null && Number.isInteger(paperLimit) && paperLimit > 0 && papers >= paperLimit;
  const protocol = project.review_protocol && typeof project.review_protocol === 'object' && !Array.isArray(project.review_protocol)
    ? project.review_protocol : null;
  const reviewFields = ['question', 'search_databases', 'search_strings', 'inclusion_criteria', 'exclusion_criteria'];
  const recordedReviewFields = protocol ? reviewFields.filter(key => String(protocol[key] || '').trim()).length : 0;
  const chapters = Array.isArray(project.thesis_outline?.chapters) ? project.thesis_outline.chapters : [];
  const hasResearchGoal = Boolean(String(project.goal || '').trim());
  return [
    {
      id: 'question', title: 'Define the research question',
      description: 'Capture your scope, objectives and a researchable question in your private project.',
      action: 'Open project', href: links.project,
      status: hasResearchGoal ? 'recorded' : 'next',
      statusText: hasResearchGoal ? 'Research goal recorded' : 'Research goal not recorded',
      caveat: 'A recorded goal is not a validated hypothesis or a reviewed protocol.',
    },
    {
      id: 'sources', title: 'Discover and assess publications',
      description: 'Find scholarly records, inspect original sources and attach relevant papers to this project.',
      action: 'Find papers', href: links.discover,
      status: papers === null ? 'unknown' : papers > 0 ? 'recorded' : 'next',
      statusText: papers === null ? 'Project paper coverage unavailable' : capped ? 'At least ' + papers + ' recently linked papers (limited view)' : papers + ' linked paper' + (papers === 1 ? '' : 's'),
      caveat: 'Saved metadata do not establish full-text access, source verification or completeness.',
      secondary: { label: 'Review Library', href: links.library },
    },
    {
      id: 'gaps', title: 'Explore research gaps',
      description: 'Compare selected records for possible contradictions, limitations and understudied questions.',
      action: 'Compare evidence', href: links.gaps, status: 'review',
      statusText: 'Researcher evaluation required',
      caveat: 'Suggested gaps are hypotheses from the selected sample, never proof that literature is absent.',
    },
    {
      id: 'protocol', title: 'Document reproducible methods',
      description: 'Record search dates, actual databases, exact queries, criteria and human screening decisions.',
      action: 'Open review protocol', href: links.review,
      status: recordedReviewFields === reviewFields.length ? 'recorded' : 'next',
      statusText: recordedReviewFields + ' of ' + reviewFields.length + ' key method fields recorded',
      caveat: 'Field presence is not methodological quality, systematic review completion or PRISMA compliance.',
    },
    {
      id: 'writing', title: 'Write and assemble your thesis',
      description: 'Compose chapters from saved Notes and track your own outline and writing progress.',
      action: 'Open Thesis Studio', href: links.thesis,
      status: chapters.length ? 'recorded' : 'next',
      statusText: chapters.length + ' outlined chapter' + (chapters.length === 1 ? '' : 's'),
      caveat: 'Chapters and word counts are author-created; they are not checked for citations or academic acceptance.',
      secondary: { label: 'Open Notes', href: links.notes },
    },
  ];
}

// A reading path, not an algorithmic quality or scientific-validity verdict.
// Never suggest that an unavailable source collection means zero publications.
export function researchJourneyNextAction(stages = []) {
  if (!Array.isArray(stages) || !stages.length) return null;
  const byId = id => stages.find(stage => stage.id === id);
  const question = byId('question');
  const sources = byId('sources');
  const protocol = byId('protocol');
  const writing = byId('writing');
  if (question?.status === 'next') return {
    label: 'Define your research goal', description: 'Record the research question and scope before evaluating evidence.', href: question.href,
  };
  if (sources?.status === 'unknown') return {
    label: 'Verify your evidence coverage', description: 'Linked paper data could not be confirmed. Refresh the workspace before drawing conclusions.', href: null,
  };
  if (sources?.status === 'next') return {
    label: 'Find and assess publications', description: 'Inspect the original sources and save relevant papers to your research project.', href: sources.href,
  };
  if (protocol?.status === 'next') return {
    label: 'Record a reproducible review method', description: 'Document actual searches, eligibility and human screening decisions.', href: protocol.href,
  };
  if (writing?.status === 'next') return {
    label: 'Outline your thesis', description: 'Create an author-controlled chapter structure in Thesis Studio.', href: writing.href,
  };
  return {
    label: 'Review your scientific evidence', description: 'Inspect counterevidence, search coverage and methodological limitations. Recorded fields do not certify completion.',
    href: byId('gaps')?.href || null,
  };
}
