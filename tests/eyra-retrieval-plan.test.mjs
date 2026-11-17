import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetrieve, compactQuery } from '../src/lib/eyra-retrieval-plan.mjs';

test('research retrieval planner respects explicit modes and Greek/English intent', () => {
  assert.equal(shouldRetrieve('hello', 'research').papers, true);
  assert.equal(shouldRetrieve('hello', 'funding').funding, true);
  assert.equal(shouldRetrieve('hello', 'team').people, true);
  const scholarly = shouldRetrieve('Αναζήτησε επιστημονική βιβλιογραφία', 'strategy');
  assert.equal(scholarly.papers, true);
  const authors = shouldRetrieve('find university researchers', 'strategy');
  assert.equal(authors.people, true);
  assert.equal(shouldRetrieve('hi', 'startup').papers, false);
});

test('short conversational retrieval query uses bounded workspace anchor', () => {
  const context = 'Research Interests: molecular biology\n- "My lab" [active]: assay work';
  const query = compactQuery('review my work', context);
  assert.ok(query.includes('molecular biology'));
  assert.ok(query.length <= 280);
  assert.equal(compactQuery('A precise research question about DNA repair', ''), 'A precise question about DNA repair');
});

test('retrieval input never creates unbounded provider query strings', () => {
  const content = 'paper '.repeat(1000);
  const query = compactQuery(content, '');
  assert.ok(query.length <= 280);
});
