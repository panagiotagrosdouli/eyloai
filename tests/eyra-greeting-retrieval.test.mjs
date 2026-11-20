import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetrieve } from '../src/lib/eyra-retrieval-plan.mjs';

test('EYRA greetings do not trigger external source retrieval in any mode', () => {
  for (const greeting of ['hi', 'Hi!', 'hello', 'hey there', 'γεια σου', 'καλημέρα']) {
    for (const mode of ['research', 'impact', 'team', 'funding']) {
      assert.deepEqual(shouldRetrieve(greeting, mode), {
        papers: false, people: false, funding: false,
      }, `Unexpected retrieval for ${greeting} in ${mode}`);
    }
  }
});

test('Research intent still retrieves appropriately, even when greeting is present', () => {
  assert.equal(shouldRetrieve('hi, find papers on causal inference', 'research').papers, true);
  assert.equal(shouldRetrieve('hi, find researchers studying causality', 'research').people, true);
  assert.equal(shouldRetrieve('hello, show funding opportunities', 'research').funding, true);
  assert.equal(shouldRetrieve('Explain causal inference', 'research').papers, true);
});
