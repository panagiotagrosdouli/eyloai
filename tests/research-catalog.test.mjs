import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESEARCH_CATALOG_KEY,
  addResearchCatalogEntry,
  clearResearchCatalog,
  exportResearchCatalogJson,
  readResearchCatalog,
  removeResearchCatalogEntry,
  researchCatalogStorageKey,
} from '../src/lib/research-catalog.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    inspect: (key) => values.get(key),
  };
}

const entry = (overrides = {}) => ({
  id: 'catalog-1', fileName: 'study.csv', sha256: 'a'.repeat(64),
  byteLength: 64, rowCount: 12, columnCount: 3, addedAt: '2026-11-12T10:00:00.000Z',
  ...overrides,
});

test('catalog persists only bounded file metadata and deduplicates exact fingerprints', () => {
  const storage = memoryStorage();
  const first = addResearchCatalogEntry(storage, entry());
  const duplicate = addResearchCatalogEntry(storage, entry({ id: 'catalog-2', addedAt: '2026-11-12T11:00:00.000Z' }));
  assert.equal(first.added, true);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(readResearchCatalog(storage), [entry()]);
  assert.equal(storage.inspect(RESEARCH_CATALOG_KEY).includes('rawRows'), false);
  assert.equal(storage.inspect(RESEARCH_CATALOG_KEY).includes('participant-secret'), false);
});

test('entries without a fingerprint remain separately addressable', () => {
  const storage = memoryStorage();
  addResearchCatalogEntry(storage, entry({ sha256: null }));
  const added = addResearchCatalogEntry(storage, entry({ id: 'catalog-2', fileName: 'second.csv', sha256: null }));
  assert.equal(added.entries.length, 2);
});

test('catalog keys isolate accounts sharing one browser and reject missing owners', () => {
  const storage = memoryStorage();
  const aliceKey = researchCatalogStorageKey('user/alice');
  const bobKey = researchCatalogStorageKey('user/bob');
  assert.notEqual(aliceKey, bobKey);
  assert.equal(researchCatalogStorageKey(null), null);
  addResearchCatalogEntry(storage, entry(), aliceKey);
  assert.equal(readResearchCatalog(storage, aliceKey).length, 1);
  assert.deepEqual(readResearchCatalog(storage, bobKey), []);
});

test('catalog removal and clear operations affect only local metadata', () => {
  const storage = memoryStorage();
  addResearchCatalogEntry(storage, entry());
  addResearchCatalogEntry(storage, entry({ id: 'catalog-2', fileName: 'second.csv', sha256: 'b'.repeat(64) }));
  assert.deepEqual(removeResearchCatalogEntry(storage, 'catalog-1').map((item) => item.id), ['catalog-2']);
  clearResearchCatalog(storage);
  assert.deepEqual(readResearchCatalog(storage), []);
});

test('catalog refuses corrupt or malformed data without silently deleting it', () => {
  const storage = memoryStorage();
  storage.setItem(RESEARCH_CATALOG_KEY, '{bad');
  assert.throws(() => readResearchCatalog(storage), /could not be read/);
  assert.equal(storage.inspect(RESEARCH_CATALOG_KEY), '{bad');
  storage.setItem(RESEARCH_CATALOG_KEY, JSON.stringify([{ ...entry(), sha256: 'not-a-hash' }]));
  assert.throws(() => readResearchCatalog(storage), /SHA-256/);
  assert.equal(storage.inspect(RESEARCH_CATALOG_KEY).includes('not-a-hash'), true);
});

test('catalog validates file bounds and caps retention', () => {
  const storage = memoryStorage();
  assert.throws(() => addResearchCatalogEntry(storage, entry({ rowCount: 10_001 })), /row count/i);
  assert.throws(() => addResearchCatalogEntry(storage, entry({ fileName: ' ' })), /file name/i);
  const entries = Array.from({ length: 100 }, (_, i) => entry({ id: `catalog-${i}`, fileName: `file-${i}.csv`, sha256: null }));
  storage.setItem(RESEARCH_CATALOG_KEY, JSON.stringify(entries));
  assert.throws(() => addResearchCatalogEntry(storage, entry({ id: 'overflow', sha256: null })), /full \(100 entries\)/);
});

test('catalog JSON export contains metadata only and disclaims anonymity', () => {
  const serialized = exportResearchCatalogJson([entry()]);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.rawDataIncluded, false);
  assert.equal(parsed.anonymityGuaranteed, false);
  assert.equal(parsed.entries[0].fileName, 'study.csv');
  assert.equal(serialized.includes('participant-secret'), false);
  assert.equal(serialized.includes('rawRows'), false);
});
