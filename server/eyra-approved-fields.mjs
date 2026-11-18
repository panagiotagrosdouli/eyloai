import { validatedEyraToolArguments } from './eyra-tool-contract.mjs';

const FIELD_LIMITS = Object.freeze({
  'project.create': Object.freeze({
    title: 180, description: 2500, goal: 1500, milestones: 2500, tasks: 2500,
  }),
  'library.save_paper': Object.freeze({ doi: 255, title: 1000 }),
});
const MAX_PROPOSAL_BYTES = 7000;

/**
 * The human must review exactly the tool input that will be executed.
 * Reject excessive, padded or opaque values instead of silently truncating
 * or changing them after a signed approval is displayed.
 */
export function boundedEyraApprovedProposal(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)
    || !Object.hasOwn(FIELD_LIMITS, proposal.tool)
    || !proposal.fields || typeof proposal.fields !== 'object' || Array.isArray(proposal.fields)) {
    throw new Error('Invalid EYRA write proposal.');
  }
  const fields = validatedEyraToolArguments(proposal.tool, JSON.stringify(proposal.fields));
  for (const [field, max] of Object.entries(FIELD_LIMITS[proposal.tool])) {
    const value = fields[field];
    if (typeof value !== 'string' || value !== value.trim() || value.length > max) {
      throw new Error('EYRA approved write contains an oversized or noncanonical field.');
    }
  }
  if (!fields.title.trim()) throw new Error('EYRA approved write requires a title.');
  if (proposal.tool === 'library.save_paper'
    && (!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(fields.doi)
      || fields.doi !== fields.doi.toLowerCase())) {
    throw new Error('EYRA approved paper DOI is invalid or not normalized.');
  }
  const canonical = { tool: proposal.tool, fields };
  if (Buffer.byteLength(JSON.stringify(canonical), 'utf8') > MAX_PROPOSAL_BYTES) {
    throw new Error('EYRA approved write exceeds the signed payload budget.');
  }
  return canonical;
}
