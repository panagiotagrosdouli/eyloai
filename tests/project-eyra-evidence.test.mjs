import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/ProjectDetail.jsx', import.meta.url), 'utf8');

test('project EYRA declines to invent a sourced report without any evidence', () => {
  assert.match(page, /!papers\.length && !researchers\.length && !opportunities\.length/);
  assert.match(page, /!savedPapers\.length && !savedResearchers\.length && !savedOpportunities\.length/);
  assert.match(page, /No verifiable evidence was retrieved/);
  assert.match(page, /No research evidence was found for this project/);
});

test('project EYRA identifies partially unavailable live research sources', () => {
  assert.match(page, /retrievalFailures\.length/);
  assert.match(page, /A failed source cannot justify a claim/);
});
