import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/products/PersonalTools.jsx', import.meta.url), 'utf8');
const memory = source.slice(source.indexOf('function Memory()'), source.indexOf('export function Spreadsheet()'));

test('Memory clears old account data and queries on account changes', () => {
  assert.match(memory, /requestGeneration\.current \+= 1/);
  assert.match(memory, /setSources\(\[\]\)/);
  assert.match(memory, /setLoadedOwnerId\(null\)/);
  assert.match(memory, /setQuery\("..."\)/);
  assert.match(memory, /\}, \[user\?\.id\]\)/);
});

test('Memory blocks cross-account session responses and stale in-flight loads', () => {
  assert.match(memory, /session\.user\.id !== user\?\.id/);
  assert.match(memory, /generation !== requestGeneration\.current/);
  assert.match(memory, /loadedOwnerId === user\?\.id/);
  assert.match(memory, /disabled=\{state\.busy \|\| !user\?\.id\}/);
});
