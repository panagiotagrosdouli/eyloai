import { CLAIM_SUPPORT_LABELS, EVIDENCE_SCOPES } from './scientific-evaluation.mjs';

export const SCIENTIFIC_ARTIFACTS = Object.freeze([
  { key: 'evidence_matrix', label: 'Evidence Matrix' },
  { key: 'literature_review', label: 'Literature Review' },
  { key: 'research_proposal', label: 'Academic Proposal' },
  { key: 'research_methodology', label: 'Methodology' },
  { key: 'grant_proposal', label: 'Grant Proposal' },
]);

const text = value => typeof value === 'string' ? value.trim() : '';
const sourceIds = value => Array.isArray(value) ? [...new Set(value.map(item => String(item?.id ?? item).trim()).filter(Boolean))] : [];
const stableId = (kind, value, index) => {
  const input = `${kind}:${text(value)}:${index}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return `${kind}:${(hash >>> 0).toString(16)}`;
};

function claimRows(artifact) {
  if (!artifact || typeof artifact !== 'object') return [];
  if (Array.isArray(artifact.ai_draft?.rows)) return artifact.ai_draft.rows.map(row => ({ text: text(row.claim || row.finding || row.summary || row.rationale || row.research_gap), sources: sourceIds(row.source_ids || [row.paper_id]), scope: row.evidence_scope || 'metadata_only' }));
  const sections = artifact.edited_sections || artifact.draft?.sections || artifact.sections || artifact.review?.sections;
  if (Array.isArray(sections)) return sections.map(section => ({ text: text(section.content || section.text || section.summary), sources: sourceIds(section.source_ids || section.source_ids_used || section.citations), scope: section.evidence_scope || 'metadata_only' }));
  if (Array.isArray(artifact.rows)) return artifact.rows.map(row => ({ text: text(row.claim || row.finding || row.statement || row.summary), sources: sourceIds(row.source_ids || [row.paper_id]), scope: row.evidence_scope || 'metadata_only' }));
  return [];
}

/** Build a private review view from saved project artifacts; no support is inferred from IDs. */
export function collectScientificReviewItems(project = {}) {
  const saved = project.scientific_quality_review && typeof project.scientific_quality_review === 'object' ? project.scientific_quality_review : {};
  return SCIENTIFIC_ARTIFACTS.flatMap(({ key, label }) => {
    const rows = claimRows(project[key]);
    return rows.filter(row => row.text).map((row, index) => {
      const id = stableId(key, row.text, index);
      const review = saved[id] || {};
      const scope = EVIDENCE_SCOPES.includes(row.scope) ? row.scope : 'metadata_only';
      const missingSources = row.sources.length === 0;
      return {
        id, artifact_key: key, artifact_label: label, claim: row.text,
        source_ids: row.sources, evidence_scope: scope,
        automated_findings: [
          ...(missingSources ? ['No linked source identifiers were recorded for this claim.'] : []),
          ...(scope === 'metadata_only' ? ['Only bibliographic metadata is recorded; semantic support has not been established.'] : []),
        ],
        assessment: CLAIM_SUPPORT_LABELS.includes(review.assessment) ? review.assessment : 'not_yet_reviewed',
        annotation: text(review.annotation).slice(0, 2000),
        limitation: text(review.limitation).slice(0, 1000),
        reviewed_at: text(review.reviewed_at),
      };
    });
  });
}

export function updateScientificReview(project, itemId, update, { now = new Date().toISOString() } = {}) {
  const item = collectScientificReviewItems(project).find(entry => entry.id === itemId);
  if (!item) throw new Error('The reviewed research claim is no longer present. Reload before saving.');
  const assessment = String(update?.assessment || item.assessment);
  if (!CLAIM_SUPPORT_LABELS.includes(assessment)) throw new Error('Choose a supported scientific review state.');
  const current = project.scientific_quality_review && typeof project.scientific_quality_review === 'object' ? project.scientific_quality_review : {};
  return {
    ...current,
    [itemId]: {
      assessment,
      annotation: text(update?.annotation).slice(0, 2000),
      limitation: text(update?.limitation).slice(0, 1000),
      reviewed_at: assessment === 'not_yet_reviewed' ? '' : now,
      artifact_key: item.artifact_key,
      source_ids: item.source_ids,
      evidence_scope: item.evidence_scope,
    },
  };
}
