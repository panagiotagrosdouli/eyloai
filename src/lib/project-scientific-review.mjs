import { normalizeDoi } from './citation-verification.mjs';
import { SCIENTIFIC_DIMENSIONS, CLAIM_SUPPORT_LABELS } from './scientific-evaluation.mjs';

export const RESEARCH_ARTIFACT_KINDS = Object.freeze([
  'evidence_matrix', 'literature_review', 'research_proposal', 'research_methodology', 'grant_proposal',
]);

const text = value => String(value ?? '').trim();
const isObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const claimRecord = (id, section, value, ids, kind) => ({
  id, section, text: text(value), source_ids: [...new Set((Array.isArray(ids) ? ids : []).map(String))], kind,
});
const factual = claim => ['source_fact', 'interpretation'].includes(claim?.kind) ? 'factual'
  : claim?.kind === 'proposal' || claim?.kind === 'open_question' ? 'proposal' : 'factual';

export function collectProjectScientificArtifacts(project, papers) {
  const ownerProject = text(project?.id);
  if (!ownerProject) throw new Error('scientific_project_identity_missing');
  const linked = (Array.isArray(papers) ? papers : []).filter(paper =>
    paper && text(paper.project_id) === ownerProject && text(paper.id));
  const sourceMap = new Map(linked.map(paper => [text(paper.id), paper]));
  const sources = linked.map(paper => ({
    id: text(paper.id), title: text(paper.title), authors: text(paper.authors),
    year: paper.year || null, doi: normalizeDoi(paper.doi),
    primary_url: text(paper.url), access: text(paper.full_text_access) === 'verified_full_text'
      ? 'full_text_claim_unverified' : paper.summary ? 'abstract_only' : 'metadata_only',
    abstract: text(paper.summary).slice(0, 5000),
    metadata_status: 'not_independently_verified',
  }));
  const artifacts = [];
  const add = (type, rows, revision) => {
    if (!rows.length) return;
    artifacts.push({
      kind: type, revision: String(revision ?? 'unversioned'), claims: rows.map(row => ({
        ...row,
        source_status: row.source_ids.length && row.source_ids.every(id => sourceMap.has(id))
          ? 'linked_project_record_only' : row.source_ids.length ? 'unresolved_source_ids' : 'no_source_citation',
        semantic_support: 'not_yet_reviewed',
        human_review: 'not_yet_reviewed',
      })),
    });
  };
  const matrix = isObject(project.evidence_matrix) ? project.evidence_matrix : {};
  const matrixRows = [];
  for (const [id, note] of Object.entries(matrix.annotations || {})) {
    if (!isObject(note)) continue;
    for (const field of ['findings', 'study_design', 'dataset', 'limitations']) {
      if (text(note[field])) matrixRows.push(claimRecord('matrix:' + id + ':' + field, field, note[field], [id], 'factual'));
    }
  }
  for (const row of matrix.ai_draft?.rows || []) {
    if (!isObject(row)) continue;
    const id = text(row.paper_id);
    if (!id) continue;
    for (const field of ['findings', 'study_design', 'dataset', 'limitations']) {
      if (text(row[field]) && !matrixRows.some(item => item.id === 'matrix:' + id + ':' + field)) {
        matrixRows.push(claimRecord('matrix:' + id + ':' + field, field, row[field], [id], 'factual'));
      }
    }
  }
  add('evidence_matrix', matrixRows, matrix.updated_at || matrix.draft_revision);

  const literature = isObject(project.literature_review) ? project.literature_review : {};
  const litSections = Array.isArray(literature.edited_sections) ? literature.edited_sections : literature.ai_draft?.sections || [];
  add('literature_review', litSections.flatMap(section => (section?.claims || []).map((claim, i) =>
    claimRecord('literature:' + text(section.section_id) + ':' + i, text(section.section_id), claim?.text, claim?.source_ids, 'factual')
  )).filter(c => c.text), literature.updated_at || literature.draft_revision);

  const proposal = isObject(project.research_proposal) ? project.research_proposal : {};
  const proposalSections = Array.isArray(proposal.edited_sections) ? proposal.edited_sections : proposal.ai_draft?.sections || [];
  const proposalRows = proposalSections.flatMap(section => (section?.claims || []).map((claim, i) =>
    claimRecord('proposal:' + text(section.section_id) + ':' + i, text(section.section_id), claim?.text, claim?.source_ids, factual(claim))
  ));
  const plan = isObject(proposal.edited_methodology) ? proposal.edited_methodology : proposal.ai_draft?.methodology_plan || {};
  for (const [section, value] of Object.entries(plan)) for (const [i, claim] of (value?.claims || []).entries()) {
    proposalRows.push(claimRecord('proposal:method:' + section + ':' + i, section, claim?.text, claim?.source_ids, factual(claim)));
  }
  add('research_proposal', proposalRows.filter(c => c.text), proposal.updated_at || proposal.draft_revision);

  const method = isObject(project.research_methodology) ? project.research_methodology : {};
  const topics = isObject(method.edited_topics) ? method.edited_topics : method.ai_draft?.topics || {};
  add('research_methodology', Object.entries(topics).flatMap(([section, value]) =>
    (value?.claims || []).map((claim, i) =>
      claimRecord('methodology:' + section + ':' + i, section, claim?.text, claim?.source_ids, factual(claim))
    )).filter(c => c.text), method.updated_at || method.draft_revision);

  const grant = isObject(project.grant_proposal) ? project.grant_proposal : {};
  const grantSections = Array.isArray(grant.edited_sections) ? grant.edited_sections : grant.draft?.sections || [];
  add('grant_proposal', grantSections.map((section, i) =>
    claimRecord('grant:' + i, text(section.heading), section.content, section.source_ids, section.source_ids?.length ? 'factual' : 'proposal')
  ).filter(c => c.text), grant.updated_at || grant.draft_revision);

  return { project_id: ownerProject, sources, artifacts,
    dimensions: SCIENTIFIC_DIMENSIONS,
    semantic_labels: CLAIM_SUPPORT_LABELS,
    independent_human_reviews: 'not_yet_reviewed',
    scientific_quality: 'not_yet_reviewed',
  };
}

export function deriveScientificDashboardFindings(snapshot) {
  const sources = new Map((snapshot?.sources || []).map(s => [s.id, s]));
  const findings = [];
  for (const artifact of snapshot?.artifacts || []) for (const claim of artifact.claims) {
    const missing = claim.source_ids.filter(id => !sources.has(id));
    if (missing.length) findings.push({ kind: 'missing_source', claim_id: claim.id, artifact: artifact.kind, message: 'Cited source ID is not linked to this project.' });
    if (claim.kind === 'factual' && !claim.source_ids.length) findings.push({ kind: 'missing_citation', claim_id: claim.id, artifact: artifact.kind, message: 'A source-based claim has no traceable citation.' });
    if (claim.kind === 'factual' && claim.source_ids.some(id => sources.get(id)?.access === 'metadata_only')) findings.push({ kind: 'insufficient_evidence', claim_id: claim.id, artifact: artifact.kind, message: 'Only bibliographic metadata is available for an associated source.' });
  }
  const grant = (snapshot?.artifacts || []).find(a => a.kind === 'grant_proposal');
  const present = new Set((snapshot?.artifacts || []).map(a => a.kind));
  if (present.has('research_methodology') && !snapshot.artifacts.find(a => a.kind === 'research_methodology')?.claims.length) {
    findings.push({ kind: 'methodology_incomplete', message: 'No methodology statements are available for independent review.' });
  }
  if (grant && grant.claims.some(c => c.kind === 'proposal' && !c.source_ids.length)) findings.push({
    kind: 'grant_requirements_review', message: 'Grant language without scholarly citations requires separate official-call requirement verification.',
  });
  return findings;
}

/** Stable snapshot fingerprint prevents carrying an approval across edits.
 * Local review records are UI-only and must not be described as independent
 * expert assessments or persisted without owner-scoped trusted service support.
 */
export function scientificSnapshotSignature(snapshot) {
  return JSON.stringify({
    project: snapshot?.project_id,
    artifacts: (snapshot?.artifacts || []).map(a=>({kind:a.kind,revision:a.revision,claims:a.claims.map(c=>[c.id,c.text,c.source_ids,c.kind])})),
    sources: (snapshot?.sources || []).map(s=>[s.id,s.doi,s.title,s.year,s.access]),
  });
}
