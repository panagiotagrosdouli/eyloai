export const RESEARCH_CATALOG_LIMIT = 100;
const LEGACY_RESEARCH_CATALOG_KEY = 'eylo.research-data-catalog.v1';

/** Legacy key retained only so account deletion can clean pre-cloud browser data. */
export function researchCatalogStorageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 200) return null;
  return `${LEGACY_RESEARCH_CATALOG_KEY}:${encodeURIComponent(userId.trim())}`;
}

/** Validate the metadata accepted by both the client and the database. */
export function normalizeResearchCatalogEntry(entry) {
  const fileName = String(entry?.fileName || '').trim();
  if (!fileName || fileName.length > 255 || /[\u0000-\u001f]/.test(fileName)) {
    throw new Error('Catalog entries need a valid file name of 255 characters or fewer.');
  }
  for (const [label, value, maximum] of [
    ['File size', entry?.byteLength, 5 * 1024 * 1024],
    ['Row count', entry?.rowCount, 10_000],
    ['Column count', entry?.columnCount, 50],
  ]) {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw new Error(`${label} is outside the supported Research Data Lab limits.`);
    }
  }
  if (entry.columnCount < 1 || entry.rowCount < 1) {
    throw new Error('Catalog entries need at least one row and one column.');
  }
  const sha256 = entry.sha256 == null ? null : String(entry.sha256);
  if (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Catalog fingerprints must be complete lowercase SHA-256 values.');
  }
  const addedAt = String(entry.addedAt || '');
  if (!Number.isFinite(Date.parse(addedAt))) throw new Error('Catalog entries need a valid saved date.');
  const id = String(entry.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Catalog entries need a valid identifier.');
  }
  return { id, fileName, sha256, byteLength: entry.byteLength, rowCount: entry.rowCount, columnCount: entry.columnCount, addedAt };
}

/** Export only user-selected metadata; the CSV contents are never included. */
export function exportResearchCatalogJson(entries) {
  const safeEntries = (Array.isArray(entries) ? entries : []).map(normalizeResearchCatalogEntry);
  if (safeEntries.length > RESEARCH_CATALOG_LIMIT) throw new Error(`Catalog export exceeds the ${RESEARCH_CATALOG_LIMIT}-entry limit.`);
  if (new Set(safeEntries.map((item) => item.id)).size !== safeEntries.length) throw new Error('Catalog export contains duplicate entry identifiers.');
  return JSON.stringify({
    format: 'eylo-research-catalog-v2',
    exportedAt: new Date().toISOString(),
    rawDataIncluded: false,
    anonymityGuaranteed: false,
    entries: safeEntries,
    scope: 'User-scoped EYLO cloud catalog metadata and optional SHA-256 fingerprints; source rows are never stored or included.',
  }, null, 2);
}
