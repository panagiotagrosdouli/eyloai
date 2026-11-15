import { isSafeLiteratureSourceUrl } from './literature-review-protocol.mjs';

function plain(value, limit = 6000) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function markdown(value, limit = 6000) {
  return plain(value, limit).replace(/([\\`*_{}\[\]()#+.!|>~-])/g, '\\$1');
}

function recorded(value) {
  return value ? markdown(value) : 'Not recorded';
}

/**
 * Create an editable, source-linked outline using only authenticated saved
 * metadata and human inclusion decisions. No evidence synthesis is invented.
 *
 * @param {{project: Record<string, any>, protocol: Record<string, any>, papers: Record<string, any>[]}} options
 * @returns {{filename: string, body: string, includedCount: number}}
 */
export function createReviewEvidenceOutline({ project, protocol, papers }) {
  if (!project?.id) throw new Error('Choose an authorized research project.');
  const allowedPapers = new Map((Array.isArray(papers) ? papers : [])
    .filter(paper => paper?.id != null)
    .map(paper => [String(paper.id), paper]));
  const included = [];
  const seen = new Set();
  for (const screening of Array.isArray(protocol?.screening) ? protocol.screening : []) {
    const id = String(screening?.paper_id || '');
    if (screening?.decision !== 'include' || seen.has(id)) continue;
    const paper = allowedPapers.get(id);
    if (!paper) continue;
    seen.add(id);
    included.push(paper);
    if (included.length >= 100) break;
  }
  if (!included.length) throw new Error('Include at least one saved paper in the screening log before preparing an evidence outline.');

  const projectName = plain(project.title || 'Research', 80);
  const filename = (projectName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Research').slice(0, 80) + ' - review outline.md';

  const lines = [
    `# ${markdown(projectName)} — evidence-linked literature review outline`,
    '',
    '> **Researcher verification required.** This is an editable outline assembled from your saved protocol and human screening decisions. EYLO has not read full texts, extracted findings, appraised risk of bias, or completed an evidence synthesis. Verify every recorded source before using it in scientific writing.',
    '',
    '## Research question',
    '',
    recorded(protocol?.question),
    '',
    '## Methods recorded in the project',
    '',
    `- Review type: ${recorded(protocol?.review_type)}`,
    `- Sources actually searched: ${recorded(protocol?.search_databases)}`,
    `- Search date: ${recorded(protocol?.search_date)}`,
    `- Exact search strings: ${recorded(protocol?.search_strings)}`,
    `- Inclusion criteria: ${recorded(protocol?.inclusion_criteria)}`,
    `- Exclusion criteria: ${recorded(protocol?.exclusion_criteria)}`,
    `- Methods notes and deviations: ${recorded(protocol?.methods_notes)}`,
    '',
    `## Included saved records (${included.length})`,
    '',
    'The following publications were marked **include** by the researcher. A screening decision is not proof that a paper meets full-text eligibility or that its findings are correct.',
    '',
  ];

  for (const [index, paper] of included.entries()) {
    lines.push(`### [${index + 1}] ${markdown(paper.title || 'Untitled saved publication', 500)}`);
    lines.push('');
    lines.push(`- Authors recorded: ${recorded(paper.authors)}`);
    lines.push(`- Year recorded: ${recorded(paper.year)}`);
    lines.push(`- DOI recorded: ${recorded(paper.doi)}`);
    const link = plain(paper.url || '', 2000);
    lines.push(isSafeLiteratureSourceUrl(link)
      ? `- Recorded source: [Open publication](<${link.replaceAll('>', '%3E')}>)`
      : '- Recorded source: No validated HTTP(S) URL available');
    lines.push('- Extracted findings: **Not provided — review the original study**');
    lines.push('- Methodological quality / bias: **Not assessed**');
    lines.push('');
  }

  lines.push(
    '## Evidence synthesis — researcher to complete',
    '',
    '- Compare study populations, study designs, outcomes, methods and limitations after reading original sources.',
    '- Summarize any agreement, heterogeneity and contradictory findings with citations to the verified included studies above.',
    '- Avoid inferring effect sizes, statistical significance or causality from titles or abstracts.',
    '',
    '## Limitations and reproducibility',
    '',
    '- Confirm that recorded searches were actually executed and document any missing databases.',
    '- Reconcile deduplication, full-text screening, exclusion reasons and quality appraisal before claiming systematic-review completeness.',
    '- Confirm original publication metadata, DOI links and any subsequently corrected or retracted studies.',
    '',
    '## References — recorded metadata only',
    '',
    ...included.map((paper, index) => `[${index + 1}] ${markdown(paper.authors || 'Authors not recorded', 500)}. ${markdown(paper.title || 'Untitled saved publication', 500)}. ${recorded(paper.year)}. Recorded DOI: ${recorded(paper.doi)}.`),
    '',
  );
  return { filename, body: lines.join('\n'), includedCount: included.length };
}
