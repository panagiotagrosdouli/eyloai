/**
 * Offline, fail-closed collection of two blinded scientific annotation packets.
 * This module only creates a DRAFT for a third-party adjudicator. It never
 * assigns ground-truth labels, reads model predictions or calls a service.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  EYRA_ANNOTATION_PACKET_PROTOCOL, EYRA_ANNOTATION_VERDICTS,
  buildBlindEyraPacket, validateEyraSourceManifest,
} from './eyra-annotation-packets.mjs';

export const EYRA_ADJUDICATION_DRAFT_PROTOCOL = 'eyra-adjudication-draft-v1';
export const EYRA_ANNOTATION_AUDIT_PROTOCOL = 'eyra-annotation-audit-v1';

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(item, expected) {
  return record(item) && isDeepStrictEqual(Object.keys(item).sort(), [...expected].sort());
}

function filledPacket(manifest, packet, reviewerId, seed) {
  const template = buildBlindEyraPacket(manifest, reviewerId, seed);
  if (!exactKeys(packet, Object.keys(template))
    || packet.protocol !== EYRA_ANNOTATION_PACKET_PROTOCOL
    || packet.dataset_id !== template.dataset_id
    || packet.reviewer_id !== reviewerId
    || packet.instructions !== template.instructions
    || !isDeepStrictEqual(packet.permitted_verdicts, template.permitted_verdicts)
    || !Array.isArray(packet.cases) || packet.cases.length !== template.cases.length) {
    throw new Error('Reviewer packet metadata, sample order or case count differs from the blinded original.');
  }
  for (let i = 0; i < template.cases.length; i++) {
    const source = template.cases[i];
    const submitted = packet.cases[i];
    if (!exactKeys(submitted, Object.keys(source))
      || submitted.id !== source.id
      || submitted.domain !== source.domain
      || submitted.claim !== source.claim
      || !isDeepStrictEqual(submitted.paper, source.paper)) {
      throw new Error('Reviewer packet source claim, title, abstract or ordering changed.');
    }
    if (!EYRA_ANNOTATION_VERDICTS.includes(submitted.verdict)
      || typeof submitted.rationale !== 'string'
      || submitted.rationale.trim().length < 10) {
      throw new Error('Reviewer packet contains missing verdict or incomplete human rationale.');
    }
  }
}

export function prepareEyraAdjudicationDraft(manifestSource, audit, reviewerA, reviewerB) {
  if (typeof manifestSource !== 'string' || !manifestSource.trim()) {
    throw new Error('The raw source manifest is required for audit verification.');
  }
  const manifest = JSON.parse(manifestSource);
  validateEyraSourceManifest(manifest);
  const expectedHash = createHash('sha256').update(manifestSource).digest('hex');
  if (!record(audit)
    || audit.protocol !== EYRA_ANNOTATION_AUDIT_PROTOCOL
    || audit.dataset_id !== manifest.dataset_id
    || audit.source_sha256 !== expectedHash
    || audit.case_count !== manifest.cases.length
    || typeof audit.seed !== 'string' || !audit.seed.trim()
    || !Array.isArray(audit.reviewer_ids) || audit.reviewer_ids.length !== 2
    || audit.reviewer_ids[0] === audit.reviewer_ids[1]
    || typeof audit.reviewer_ids[0] !== 'string' || typeof audit.reviewer_ids[1] !== 'string') {
    throw new Error('Source audit hash, participant IDs or case count do not match the original study.');
  }
  filledPacket(manifest, reviewerA, audit.reviewer_ids[0], audit.seed);
  filledPacket(manifest, reviewerB, audit.reviewer_ids[1], audit.seed);
  const a = new Map(reviewerA.cases.map(item => [item.id, item]));
  const b = new Map(reviewerB.cases.map(item => [item.id, item]));
  const cases = manifest.cases.map(item => {
    const left = a.get(item.id), right = b.get(item.id);
    const disagreement = left.verdict !== right.verdict;
    return {
      id: item.id,
      domain: item.domain,
      claim: item.claim,
      paper: item.paper,
      independent_labels: [
        { reviewer_id: reviewerA.reviewer_id, verdict: left.verdict, rationale: left.rationale },
        { reviewer_id: reviewerB.reviewer_id, verdict: right.verdict, rationale: right.rationale },
      ],
      reviewer_disagreement: disagreement,
      adjudicated_verdict: null,
      adjudication_rationale: '',
      adjudication_resolution: '',
    };
  });
  return {
    protocol: EYRA_ADJUDICATION_DRAFT_PROTOCOL,
    dataset_id: manifest.dataset_id,
    source_sha256: expectedHash,
    status: 'needs_independent_adjudication',
    warning: 'This is a DRAFT, NOT labelled ground truth. A third-party adjudicator must review every case. Model outputs are intentionally excluded.',
    case_count: cases.length,
    disagreement_count: cases.filter(item => item.reviewer_disagreement).length,
    cases,
  };
}
