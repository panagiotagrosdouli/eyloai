import test from 'node:test';
import assert from 'node:assert/strict';
import { safeResearchSourceUrl } from '../src/lib/research-source-url.mjs';

test('scholarly source links accept HTTPS and reject unsafe or malformed URLs', () => {
  assert.equal(safeResearchSourceUrl({ url: ' https://publisher.example/article?id=1 ' }), 'https://publisher.example/article?id=1');
  assert.equal(safeResearchSourceUrl({ url: 'http://publisher.example/article' }), '');
  assert.equal(safeResearchSourceUrl({ url: 'javascript:alert(1)' }), '');
  assert.equal(safeResearchSourceUrl({ url: 'https://user:pass@publisher.example/article' }), '');
  assert.equal(safeResearchSourceUrl({ url: 'https://?query=article' }), '');
  assert.equal(safeResearchSourceUrl(null), '');
});

test('scholarly source links can fall back to a validated DOI', () => {
  assert.equal(safeResearchSourceUrl({ url: 'javascript:alert(1)', doi: 'https://doi.org/10.1234/abc.def' }), 'https://doi.org/10.1234/abc.def');
  assert.equal(safeResearchSourceUrl({ doi: '10.1234/unsafe%0aheader' }), '');
  assert.equal(safeResearchSourceUrl({ doi: 'https://attacker.example/10.1234/abc' }), '');
});
