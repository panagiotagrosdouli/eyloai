import test from 'node:test';
import assert from 'node:assert/strict';
import { filterUnsupportedEvidenceClaims, traceableGapHypotheses } from '../src/lib/research-provenance.mjs';

test('never outputs uncited or invented literature-gap claims', () => {
  assert.deepEqual(traceableGapHypotheses(['No evidence', 'Hypothesis [P99]', 'Possible gap [P1]'], 1), ['Possible gap [P1]']);
});

test('rejects missing and invalid citations even if another citation is valid', () => {
  assert.deepEqual(traceableGapHypotheses(['Gap [P1] [P0]', 'Gap [P1] [P13]', 'Gap [P2]'], 2), ['Gap [P2]']);
});

test('rejects gaps without retrieved literature and handles malformed input', () => {
  assert.deepEqual(traceableGapHypotheses(['Maybe [P1]'], 0), []);
  assert.deepEqual(traceableGapHypotheses(null, 10), []);
  assert.deepEqual(traceableGapHypotheses([null, 4, ' '], 10), []);
});

test('only first twelve supplied context papers can be cited', () => {
  assert.deepEqual(traceableGapHypotheses(['Supported by sample [P12]', 'Not in sample [P13]'], 100), ['Supported by sample [P12]']);
});

test('filters EYRA findings and trends with missing or out-of-range evidence citations', () => {
  const analysis = filterUnsupportedEvidenceClaims({
    key_findings: [
      { finding: 'Supported paper claim', evidence: 'Source [P2]' },
      { finding: 'Unsupported claim', evidence: 'No source provided' },
      { finding: 'Invented source', evidence: 'Source [P13]' },
      { finding: 'Researcher claim', evidence: 'Authorship record [Researcher 2]' },
      { finding: 'Unknown researcher', evidence: 'Authorship record [Researcher 7]' },
    ],
    trends: [
      { title: 'Supported trend', evidence: 'Paper [P1]' },
      { title: 'Uncited trend', evidence: 'No paper supplied' },
      { title: 'Researcher-only trend', evidence: 'Person [Researcher 1]' },
    ],
    suggested_roles: [
      { role: 'Supported role', evidence: 'Need shown in [P3]' },
      { role: 'Uncited role', evidence: '' },
    ],
    research_gaps: ['Cited sample limitation [P1]', 'Invented citation [P14]'],
    goal_analysis: 'The source-grounded summary is retained.',
  }, { paperCount: 12, researcherCount: 6 });

  assert.deepEqual(analysis.key_findings.map(item => item.finding), ['Supported paper claim', 'Researcher claim']);
  assert.deepEqual(analysis.trends.map(item => item.title), ['Supported trend']);
  assert.deepEqual(analysis.suggested_roles.map(item => item.role), ['Supported role']);
  assert.deepEqual(analysis.research_gaps, ['Cited sample limitation [P1]']);
  assert.equal(analysis.goal_analysis, 'The source-grounded summary is retained.');
});
