import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDraftCompleteness, rankResearchersForRoles } from '../src/lib/team-planner-evidence.mjs';

test('ranks real researcher records by transparent topic overlap with proposed roles', () => {
  const candidates = [
    { id: 'a', name: 'Climate author', research_areas: 'urban climate adaptation, heat islands' },
    { id: 'b', name: 'Methods author', research_areas: 'systematic reviews, public health' },
    { id: 'c', name: 'Unindexed author', research_areas: '' },
  ];
  const result = rankResearchersForRoles(candidates, [
    { role: 'Urban climate', key_skills: ['heat adaptation'] },
    { role: 'Evidence synthesis', key_skills: ['systematic reviews', 'public health'] },
  ]);
  assert.deepEqual(result.map((item) => item.researcher.id), ['a', 'b', 'c']);
  assert.deepEqual(result[0].roleMatches, [{ role: 'Urban climate', terms: ['urban', 'climate', 'heat', 'adaptation'], coverage: 1 }]);
  assert.deepEqual(result[1].roleMatches, [{ role: 'Evidence synthesis', terms: ['systematic', 'reviews', 'public', 'health'], coverage: 0.67 }]);
  assert.deepEqual(result[2].roleMatches, []);
});

test('does not invent topic fit from name, affiliation or citation counts', () => {
  const [candidate] = rankResearchersForRoles([{
    id: 'x', name: 'Climate Adaptation Professor', institution: 'Climate Institute', citation_count: 10000, research_areas: '',
  }], [{ role: 'Climate Adaptation Scientist', key_skills: ['urban heat'] }]);
  assert.equal(candidate.score, 0);
  assert.deepEqual(candidate.roleMatches, []);
});

test('role matching is deterministic and Unicode accent-insensitive', () => {
  const [result] = rankResearchersForRoles([{ research_areas: 'Épidémiologie, santé publique' }], [
    { role: 'Epidemiologie', key_skills: ['sante publique'] },
  ]);
  assert.equal(result.score, 1);
  assert.deepEqual(result.matchedTerms, ['epidemiologie', 'sante', 'publique']);
});

test('draft completeness is derived from filled sections and ignores model score fields', () => {
  const partial = { team_health_score: 100, project_summary: 'Plan only' };
  const complete = {
    project_summary: 'A source-backed project description',
    current_gaps: ['No clinical partner identified'],
    hiring_sequence: ['Engage data lead'],
    consortium_partners: [{ role: 'Clinical cohort partner' }],
    eyra_team_insight: 'Needs domain validation',
    first_hire_advice: 'Start with data lead',
    dream_team: [{ role: 'Data lead', why_needed: 'Build analysis', key_skills: ['statistics'], ideal_background: 'Health data', where_to_find: 'Research labs', outreach_hook: 'Share the protocol' }],
  };
  assert.equal(calculateDraftCompleteness(partial), 14);
  assert.equal(calculateDraftCompleteness(complete), 100);
  assert.equal(calculateDraftCompleteness({}), 0);
});
