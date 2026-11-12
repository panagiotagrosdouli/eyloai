/**
 * SHA-256 reproducibility fingerprint of the exact original file bytes.
 * Hashes support file identity comparison, not proof of data validity or
 * study reproducibility; small/predictable files may be guessable by hash.
 */
export async function sha256ResearchFile(bytes, subtle = globalThis.crypto?.subtle) {
  if (!subtle?.digest) {
    throw Object.assign(new Error('SHA-256 is unavailable in this browser context.'), {
      code: 'RESEARCH_DIGEST_UNAVAILABLE',
    });
  }
  if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) {
    throw new TypeError('File bytes must be an ArrayBuffer or typed array.');
  }
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function buildResearchDataProvenance({ fileName, byteLength, sha256, rowCount, columnCount }) {
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || ''))) throw new Error('A verified SHA-256 digest is required.');
  if (!Number.isSafeInteger(byteLength) || byteLength < 0
    || !Number.isSafeInteger(rowCount) || rowCount < 0
    || !Number.isSafeInteger(columnCount) || columnCount < 0) {
    throw new Error('File and dataset dimensions must be nonnegative integers.');
  }
  return {
    algorithm: 'SHA-256',
    file_name: String(fileName || '').slice(0, 255),
    file_bytes: byteLength,
    sha256,
    data_rows: rowCount,
    columns: columnCount,
    scope: 'exact original local CSV file bytes',
    disclaimer: 'This fingerprint verifies file identity only. It is not a signature, integrity attestation, data-quality assessment or proof of research reproducibility. Never treat hashes of predictable private files as secret.',
  };
}
