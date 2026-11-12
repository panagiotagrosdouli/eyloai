export const RESEARCH_CATALOG_KEY = 'eylo.research-data-catalog.v1';
export const RESEARCH_CATALOG_LIMIT = 100;

export function researchCatalogStorageKey(userId) {
  if (typeof userId !== 'string' || !userId.trim() || userId.length > 200) return null;
  return `${RESEARCH_CATALOG_KEY}:${encodeURIComponent(userId.trim())}`;
}

function validateEntry(entry) {
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
  if (!id || id.length > 100) throw new Error('Catalog entries need a valid identifier.');
  return { id, fileName, sha256, byteLength: entry.byteLength, rowCount: entry.rowCount, columnCount: entry.columnCount, addedAt };
}

/** Read bounded metadata from browser storage; never repairs corrupt data silently. */
export function readResearchCatalog(storage = globalThis.localStorage, key = RESEARCH_CATALOG_KEY) {
  if (!storage?.getItem) throw new Error('This browser does not provide local catalog storage.');
  const raw = storage.getItem(key);
  if (raw == null || raw === '') return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    throw new Error('The local catalog could not be read. Export or clear the damaged catalog before continuing.');
  }
  if (!Array.isArray(parsed) || parsed.length > RESEARCH_CATALOG_LIMIT) {
    throw new Error('The local catalog is malformed or exceeds its entry limit.');
  }
  const entries = parsed.map(validateEntry);
  if (new Set(entries.map((item) => item.id)).size !== entries.length) {
    throw new Error('The local catalog contains duplicate entry identifiers. Clear the damaged catalog before continuing.');
  }
  return entries.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** Add only bounded metadata. Re-adding the same fingerprint is idempotent. */
export function addResearchCatalogEntry(storage, entry, key = RESEARCH_CATALOG_KEY) {
  const candidate = validateEntry(entry);
  const existing = readResearchCatalog(storage, key);
  if (candidate.sha256 && existing.some((item) => item.sha256 === candidate.sha256)) {
    return { entries: existing, added: false, duplicate: true };
  }
  if (existing.length >= RESEARCH_CATALOG_LIMIT) {
    throw new Error(`The local catalog is full (${RESEARCH_CATALOG_LIMIT} entries). Remove an entry before adding another.`);
  }
  const entries = [candidate, ...existing];
  try { storage.setItem(key, JSON.stringify(entries)); } catch {
    throw new Error('The browser could not save this catalog entry. Free local storage or remove older entries and retry.');
  }
  return { entries, added: true, duplicate: false };
}

export function removeResearchCatalogEntry(storage, id, key = RESEARCH_CATALOG_KEY) {
  const entries = readResearchCatalog(storage, key).filter((item) => item.id !== id);
  storage.setItem(key, JSON.stringify(entries));
  return entries;
}

export function clearResearchCatalog(storage, key = RESEARCH_CATALOG_KEY) {
  if (!storage?.removeItem) throw new Error('This browser does not provide local catalog storage.');
  storage.removeItem(key);
}

/** Export metadata only, with an explicit warning that metadata can still be sensitive. */
export function exportResearchCatalogJson(entries) {
  const safeEntries = (Array.isArray(entries) ? entries : []).map(validateEntry);
  if (safeEntries.length > RESEARCH_CATALOG_LIMIT) throw new Error(`Catalog export exceeds the ${RESEARCH_CATALOG_LIMIT}-entry limit.`);
  if (new Set(safeEntries.map((item) => item.id)).size !== safeEntries.length) throw new Error('Catalog export contains duplicate entry identifiers.');
  return JSON.stringify({
    format: 'eylo-local-research-catalog-v1',
    exportedAt: new Date().toISOString(),
    rawDataIncluded: false,
    anonymityGuaranteed: false,
    entries: safeEntries,
    scope: 'Browser-local dataset file metadata and optional SHA-256 fingerprints; source rows are never stored or included.',
  }, null, 2);
}
