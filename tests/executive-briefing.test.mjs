import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  executiveBriefingNoteContent,
  normalizeExecutiveBriefing,
  normalizeStoredExecutiveBriefing,
} from '../src/lib/executive-briefing.mjs';

test('briefing evidence signals resolve only exact IDs from retrieved records', () => {
  const papers = [
    { title: 'Verified paper', url: 'https://doi.org/10.1000/example', source: 'Crossref' },
  ];
  const funding = [{ title: 'Official call', source_url: 'https://funding.example/call', deadline: '2026-12-01' }];
  const projects = [{ title: 'Saved project', id: 'project-1' }];
  const result = normalizeExecutiveBriefing({
    weekly_focus: 'Review evidence',
    paper_signals: [
      { source_id: 'P1', significance: 'Relevant result' },
      { source_id: 'P01', significance: 'Malformed ID' },
      { source_id: 'P2', significance: 'Out of range' },
      { source_id: 'P1F1', significance: 'Mixed ID' },
    ],
    funding_matches: [
      { source_id: 'F1', action: 'Check eligibility' },
      { source_id: 'F0', action: 'Invalid index' },
    ],
    project_health: [
      { source_id: 'J1', status: 'yellow', note: 'Check the milestone' },
      { source_id: 'J2', status: 'red', note: 'Unknown project' },
      { source_id: 'J1', status: 'unknown', note: 'Invalid status' },
    ],
  }, { papers, funding, projects, generatedAt: '2026-11-15T12:00:00Z' });

  assert.equal(result.new_discoveries.length, 1);
  assert.equal(result.new_discoveries[0].item, 'Verified paper');
  assert.equal(result.new_discoveries[0].source_url, 'https://doi.org/10.1000/example');
  assert.equal(result.funding_alerts.length, 1);
  assert.equal(result.funding_alerts[0].alert, 'Official call');
  assert.deepEqual(result.project_health, [{ project: 'Saved project', status: 'yellow', note: 'Check the milestone' }]);
});

test('briefing normalization bounds text and rejects unsafe source links', () => {
  const result = normalizeExecutiveBriefing({
    strategic_summary: 'x'.repeat(2000),
    paper_signals: [{ source_id: 'P1', significance: 'Evidence' }],
    funding_matches: [{ source_id: 'F1', action: 'Review' }],
  }, {
    papers: [{ title: 'Unsafe URL paper', url: 'javascript:alert(1)' }],
    funding: [{ title: 'Private URL call', source_url: 'https://user:secret@funding.example/call' }],
    generatedAt: '2026-11-15T12:00:00Z',
  });
  assert.equal(result.strategic_summary.length, 1200);
  assert.deepEqual(result.new_discoveries, []);
  assert.deepEqual(result.funding_alerts, []);
});

test('stored briefing snapshots are revalidated before render and Notes export', () => {
  const stored = normalizeStoredExecutiveBriefing({
    generated_at: '2026-11-15T12:00:00Z', weekly_focus: '<script>unsafe</script>',
    _source_counts: { papers: 12, funding: -2 },
    new_discoveries: [{ item: 'Real paper', significance: 'Signal', source_url: 'javascript:bad()' }],
  });
  assert.equal(stored.weekly_focus, '<script>unsafe</script>');
  assert.deepEqual(stored._source_counts, { papers: 12, funding: 0 });
  assert.deepEqual(stored.new_discoveries, []);
  assert.match(executiveBriefingNoteContent(stored), /AI planning suggestions are conditional judgments/);
  assert.throws(() => normalizeStoredExecutiveBriefing({ generated_at: 'yesterday' }));
});

test('Executive Briefing restores and saves through owner-scoped canonical Notes instead of localStorage', () => {
  const source = readFileSync(new URL('../src/pages/ExecutiveBriefing.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /Note\.filter\(\{ kind: 'executive_briefing' \}.*me\.id\)/);
  assert.match(source, /Note\.create\([\s\S]*?\}, user\.id\)/);
  assert.match(source, /Export JSON/);
  assert.match(source, /Save to Notes/);
});
