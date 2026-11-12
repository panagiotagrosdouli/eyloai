import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResearchDataLab.jsx', import.meta.url), 'utf8');

test('quality audit runs on loaded browser-local dataset only', () => {
  assert.match(source, /dataset \? auditResearchDataQuality\(dataset\) : null/);
  assert.match(source, /Missing-data and consistency audit/);
  assert.match(source, /quality\.columns\.map/);
  assert.match(source, /No missing values are imputed/);
});

test('quality JSON export omits the raw dataset and stays on device', () => {
  assert.match(source, /Export quality JSON/);
  assert.match(source, /audit: quality/);
  assert.match(source, /file_name: filename/);
  assert.match(source, /no raw dataset rows/);
  assert.doesNotMatch(source, /fetch\(.*quality/);
});
