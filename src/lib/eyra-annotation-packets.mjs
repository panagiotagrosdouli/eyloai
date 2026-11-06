/**
 * Offline blind-annotation packet preparation for independently reviewed
 * scientific claims. These packets deliberately contain no model verdicts,
 * expected labels or adjudications. No network or AI calls are performed.
 */
import { createHash } from 'node:crypto';

export const EYRA_SOURCE_MANIFEST_PROTOCOL = 'eyra-source-candidates-v1';
export const EYRA_ANNOTATION_PACKET_PROTOCOL = 'eyra-blind-annotation-v1';
export const EYRA_ANNOTATION_VERDICTS = Object.freeze(['supported', 'partial', 'unsupported', 'insufficient']);

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const nonblank = value => typeof value === 'string' && Boolean(value.trim());

export function validateEyraSourceManifest(manifest) {
  if (!isRecord(manifest)
    || manifest.protocol !== EYRA_SOURCE_MANIFEST_PROTOCOL
    || !nonblank(manifest.dataset_id)
    || !exactKeys(manifest, ['protocol', 'dataset_id', 'cases'])
    || !Array.isArray(manifest.cases) || manifest.cases.length < 1) {
    throw new Error('Invalid source-only claim manifest; labels and model responses are forbidden.');
  }
  const ids = new Set();
  for (const item of manifest.cases) {
    if (!isRecord(item)
      || !exactKeys(item, ['id', 'domain', 'claim', 'paper'])
      || !nonblank(item.id) || ids.has(item.id)
      || !nonblank(item.domain) || !nonblank(item.claim)
      || !isRecord(item.paper)
      || !exactKeys(item.paper, ['title', 'abstract', 'url'])
      || !nonblank(item.paper.title)
      || !nonblank(item.paper.abstract) || item.paper.abstract.trim().length < 20
      || !nonblank(item.paper.url) || !/^https:\/\//i.test(item.paper.url)) {
      throw new Error('Invalid or duplicate source case. No model verdicts, human labels or extra fields allowed.');
    }
    ids.add(item.id);
  }
  return true;
}

export function buildBlindEyraPacket(manifest, reviewerId, seed) {
  validateEyraSourceManifest(manifest);
  if (!nonblank(reviewerId) || !/^[a-zA-Z0-9_-]{2,40}$/.test(reviewerId) || !nonblank(seed)) {
    throw new Error('Distinct pseudonymous reviewer ID and nonempty study seed required.');
  }
  const ranking = item => createHash('sha256')
    .update(JSON.stringify([seed, reviewerId, item.id])).digest('hex');
  const selected = [...manifest.cases].sort((a, b) => ranking(a).localeCompare(ranking(b)));
  return {
    protocol: EYRA_ANNOTATION_PACKET_PROTOCOL,
    dataset_id: manifest.dataset_id,
    reviewer_id: reviewerId,
    instructions: 'Read the source abstract and assess only whether it supports the claim. Do not view EYRA model outputs or other reviewers\' labels. Fill verdict and rationale.',
    permitted_verdicts: [...EYRA_ANNOTATION_VERDICTS],
    cases: selected.map(item => ({
      id: item.id,
      domain: item.domain,
      claim: item.claim,
      paper: { title: item.paper.title, abstract: item.paper.abstract, url: item.paper.url },
      verdict: null,
      rationale: '',
    })),
  };
}

export function verifyIndependentEyraPackets(a, b) {
  if (!isRecord(a) || !isRecord(b)
    || a.protocol !== EYRA_ANNOTATION_PACKET_PROTOCOL
    || b.protocol !== EYRA_ANNOTATION_PACKET_PROTOCOL
    || a.dataset_id !== b.dataset_id
    || a.reviewer_id === b.reviewer_id
    || !Array.isArray(a.cases) || !Array.isArray(b.cases)) {
    throw new Error('Expected separate blind packets for two distinct reviewers.');
  }
  const ids = packet => packet.cases.map(item => item.id).sort();
  if (JSON.stringify(ids(a)) !== JSON.stringify(ids(b))) {
    throw new Error('Reviewers did not receive exactly the same evaluation cases.');
  }
  return true;
}
