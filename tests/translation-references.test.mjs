import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTranslationReferences } from '../src/lib/translation-references.mjs';
test('translation preserves repeated numeric citations, DOI and URL references', () => {
  assert.equal(assertTranslationReferences('Claim [1, 2] and [1]. DOI 10.1000/abc. https://example.org/paper.', 'https://example.org/paper. Μελέτη [1] και [1, 2]. DOI 10.1000/abc.'), true);
  assert.equal(assertTranslationReferences('Hello world', 'Γεια σου κόσμε'),true);
});
test('translation cannot silently lose, invent or alter supported references', () => {
  for (const [source,result] of [
    ['Claim [1]','Ισχυρισμός'],['Claim','Ισχυρισμός [2]'],
    ['Claim [1] [1]','Ισχυρισμός [1]'],['Claim [1–3]','Ισχυρισμός [1-3]'],
    ['DOI 10.1000/abc','DOI 10.1000/abcd'],
    ['https://example.org/source','https://example.org/other'],
  ]) assert.throws(()=>assertTranslationReferences(source,result), /reference check failed/);
  assert.throws(()=>assertTranslationReferences('Source','   '),/nonempty/);
});
