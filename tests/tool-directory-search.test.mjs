import test from 'node:test';
import assert from 'node:assert/strict';
import { filterToolGroups } from '../src/lib/tool-directory-search.mjs';

const groups = [
  { section: 'Research tools', description: 'Scholarly workflows', items: [
    { path: '/research-gaps', label: 'Research gap finder', desc: 'Compare papers' },
    { path: '/literature-review', label: 'Literature review protocol', desc: 'Document methods' },
  ] },
  { section: 'Workspace', description: 'Personal tools', items: [
    { path: '/study-planner', label: 'Study Planner', desc: 'Plan your courses' },
  ] },
];

test('empty searches preserve the full directory', () => {
  assert.equal(filterToolGroups(groups, '  '), groups);
});

test('section search discovers tools without matching individual labels', () => {
  assert.equal(filterToolGroups(groups, 'scholarly')[0].items.length, 2);
});

test('common synonyms and Greek accents find the intended tool', () => {
  assert.equal(filterToolGroups(groups, 'PRISMA')[0].items[0].path, '/literature-review');
  assert.equal(filterToolGroups(groups, 'ερευνητικό κενό')[0].items[0].path, '/research-gaps');
  assert.equal(filterToolGroups(groups, 'διάβασμα')[0].items[0].path, '/study-planner');
});

test('multi-word search requires each normalized term and preserves order', () => {
  assert.deepEqual(filterToolGroups(groups, 'research nonsense'), []);
  assert.deepEqual(filterToolGroups(groups, 'Research tools')[0].items.map(item => item.path), ['/research-gaps','/literature-review']);
});
