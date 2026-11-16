import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedEyraWrites } from '../src/lib/eyra-write-intent.mjs';

const NONE = { project: false, paper: false };

test('reading Library records and explaining projects never authorize writes', () => {
  for (const query of [
    'What is in my Library?',
    'Show the papers in my Library.',
    'List my papers and saved publications.',
    'Where are my saved papers in my Library?',
    'Tell me how to save an article to the Library.',
    'Explain how to create a project.',
    'What does "create a project" mean?',
    'Open my current project.',
    'Tell me about a new project.',
    'Πώς να φτιάξω ένα νέο έργο;',
    'Τι περιέχει η βιβλιοθήκη μου;',
  ]) {
    assert.deepEqual(requestedEyraWrites(query), NONE, query);
  }
});

test('positive current-turn commands retain English and Greek project/paper writes', () => {
  const inputs = [
    ['Create a project about climate change.', { project: true, paper: false }],
    ['Please make a new project for my thesis.', { project: true, paper: false }],
    ['Can you start a project about AI ethics?', { project: true, paper: false }],
    ['Create a project and save this article.', { project: true, paper: true }],
    ['Save this paper to my Library.', { project: false, paper: true }],
    ['Add this publication to my Library.', { project: false, paper: true }],
    ['Store this article for later.', { project: false, paper: true }],
    ['Δημιούργησε ένα νέο έργο για το διδακτορικό.', { project: true, paper: false }],
    ['Φτιάξε έργο για την έρευνά μου.', { project: true, paper: false }],
    ['Αποθήκευσε αυτό το άρθρο.', { project: false, paper: true }],
    ['Πρόσθεσε τη δημοσίευση στη βιβλιοθήκη μου.', { project: false, paper: true }],
  ];
  for (const [input, expected] of inputs) {
    assert.deepEqual(requestedEyraWrites(input), expected, input);
  }
});

test('negative commands are scoped per independent clause; never infer approval for a denied operation', () => {
  const cases = [
    ["Don't create a project, but save this paper to my Library.", { project: false, paper: true }],
    ["Create a project, but don't save the article.", { project: true, paper: false }],
    ['Do not create a project or save the paper.', NONE],
    ['Never save the paper. Create a project for this topic.', { project: true, paper: false }],
    ['Μην δημιουργήσεις έργο, αλλά αποθήκευσε αυτό το άρθρο.', { project: false, paper: true }],
    ['Μη αποθήκευσε το άρθρο, φτιάξε ένα έργο.', { project: true, paper: false }],
    ['Explain how to create a project, but save this article.', { project: false, paper: true }],
  ];
  for (const [input, expected] of cases) assert.deepEqual(requestedEyraWrites(input), expected, input);
});

test('input that cannot safely establish latest-turn intent remains non-authorizing', () => {
  for (const input of [null, undefined, { content: 'Create project' }, '', 'x'.repeat(2001)]) {
    assert.deepEqual(requestedEyraWrites(input), NONE);
  }
});
