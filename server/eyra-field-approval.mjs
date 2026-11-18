import crypto from 'node:crypto';
import { boundedEyraApprovedProposal } from './eyra-approved-fields.mjs';

const MAX_AGE_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function approvedEyraWritesEnabled() {
  return process.env.EYRA_FIELD_APPROVAL_ENABLED === 'true'
    && process.env.EYRA_DURABLE_RUNS_ENABLED === 'true'
    && typeof process.env.EYRA_WRITE_APPROVAL_SECRET === 'string'
    && Buffer.byteLength(process.env.EYRA_WRITE_APPROVAL_SECRET, 'utf8') >= 32;
}

function signingKey() {
  if (!approvedEyraWritesEnabled()) throw new Error('EYRA approved writes are not activated.');
  return process.env.EYRA_WRITE_APPROVAL_SECRET;
}

/** Signed, short-lived approval capability. Not a stored authorization or a replay guard. */
export function sealEyraWriteProposal({ ownerId, request, proposal, now = Date.now(), id = crypto.randomUUID() }) {
  const key = signingKey();
  if (typeof ownerId !== 'string' || !UUID.test(ownerId)
    || typeof request !== 'string' || !request.trim() || request.length > 2000
    || !UUID.test(id) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error('Invalid EYRA write approval identity.');
  }
  const approved = boundedEyraApprovedProposal(proposal);
  const payload = {
    v: 1, owner_id: ownerId, request, tool: approved.tool,
    fields: approved.fields, id, issued_at: now, expires_at: now + MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  const token = encoded + '.' + signature;
  if (token.length > 16_000) throw new Error('EYRA approval token exceeds the signed payload budget.');
  return token;
}

/** Verify the exact server-authenticated owner, user request, signature and expiration. */
export function verifyEyraWriteApproval(token, { ownerId, request, now = Date.now() }) {
  const key = signingKey();
  if (typeof token !== 'string' || token.length > 16_000
    || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('Invalid EYRA approval token.');
  }
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', key).update(encoded).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new Error('Invalid EYRA approval signature.');
  }
  let data;
  try { data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); }
  catch { throw new Error('Invalid EYRA approval payload.'); }
  if (data?.v !== 1 || data.owner_id !== ownerId || data.request !== request
    || !UUID.test(String(data.id || ''))
    || !Number.isSafeInteger(data.issued_at) || !Number.isSafeInteger(data.expires_at)
    || !Number.isSafeInteger(now) || now < data.issued_at || now >= data.expires_at
    || data.expires_at - data.issued_at !== MAX_AGE_MS) {
    throw new Error('EYRA approval is expired or does not belong to this request.');
  }
  return { id: data.id, proposal: boundedEyraApprovedProposal({ tool: data.tool, fields: data.fields }) };
}
