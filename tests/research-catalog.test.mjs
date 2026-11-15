import test from 'node:test';
import assert from 'node:assert/strict';
import { exportResearchCatalogJson, normalizeResearchCatalogEntry } from '../src/lib/research-catalog.mjs';

const entry = (overrides = {}) => ({
  id: '20000000-0000-4000-8000-000000000001', fileName: 'study.csv', sha256: 'a'.repeat(64),
  byteLength: 64, rowCount: 12, columnCount: 3, addedAt: '2026-11-12T10:00:00.000Z', ...overrides,
});

test('cloud catalog metadata rejects invalid names, sizes, dimensions, timestamps and hashes', () => {
  assert.deepEqual(normalizeResearchCatalogEntry(entry()), entry());
  assert.throws(() => normalizeResearchCatalogEntry(entry({ fileName: ' ' })), /file name/i);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ fileName: 'bad\nname.csv' })), /file name/i);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ byteLength: 5 * 1024 * 1024 + 1 })), /File size/);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ rowCount: 10_001 })), /Row count/);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ columnCount: 51 })), /Column count/);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ sha256: 'not-a-hash' })), /SHA-256/);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ id: 'not-a-uuid' })), /identifier/);
  assert.throws(() => normalizeResearchCatalogEntry(entry({ addedAt: 'invalid' })), /saved date/);
});

test('catalog export contains only validated metadata and does not claim anonymity', () => {
  const serialized = exportResearchCatalogJson([entry()]);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.format, 'eylo-research-catalog-v2');
  assert.equal(parsed.rawDataIncluded, false);
  assert.equal(parsed.anonymityGuaranteed, false);
  assert.equal(parsed.entries[0].fileName, 'study.csv');
  assert.equal(serialized.includes('participant-secret'), false);
  assert.equal(serialized.includes('rawRows'), false);
  assert.throws(() => exportResearchCatalogJson([entry(), entry()]), /duplicate/);
});
