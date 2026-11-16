import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNewMonitoringDiscoveries, safeMonitoringSourceUrl } from '../src/lib/monitoring-records.mjs';

test('removes provider duplicates within the same batch and against saved discoveries', () => {
  const candidates = [
    { source: 'OpenAlex', externalId: 'W1', title: 'original' },
    { source: 'OpenAlex', externalId: 'W1', title: 'repeated' },
    { source: 'arXiv', externalId: 'W1', title: 'distinct source' },
    { source: 'OpenAlex', externalId: 'W2', title: 'already saved' },
    { source: 'OpenAlex', externalId: '', title: 'missing source id' },
  ];
  const result = selectNewMonitoringDiscoveries(candidates, [{ source: 'OpenAlex', externalId: 'W2' }]);
  assert.deepEqual(result.map(x => x.title), ['original', 'distinct source']);
});

test('source and external ID pairs do not collide when containing separators', () => {
  assert.equal(selectNewMonitoringDiscoveries([
    {source:'foo|bar',externalId:'baz'},
    {source:'foo',externalId:'bar|baz'},
  ]).length, 2);
});

test('ignores malformed provider rows rather than storing unidentifiable notifications', () => {
  assert.deepEqual(selectNewMonitoringDiscoveries([null, {}, {source:'',externalId:'A'}, {source:'x',externalId:0}]), [{source:'x',externalId:0}]);
  assert.deepEqual(selectNewMonitoringDiscoveries('bad', null), []);
});

test('normalizes valid HTTPS source links, rejects unsafe and credential-bearing URLs', () => {
  assert.equal(safeMonitoringSourceUrl(' https://openalex.org/W123?x=1 '), 'https://openalex.org/W123?x=1');
  for (const unsafe of [null, '', 'javascript:alert(1)', 'data:text/html,x', 'http://example.org', '//example.org/a', '/relative', 'https://user:pass@example.org', 'https://example.org/\nalert', 'https://example.org/'+ 'x'.repeat(2050), { href: 'https://example.org' }]) {
    assert.equal(safeMonitoringSourceUrl(unsafe), null, String(unsafe));
  }
});

test('watchlist and notification screens apply the shared safety rules', async () => {
  const { readFile } = await import('node:fs/promises');
  const monitor = await readFile(new URL('../src/lib/monitoring-service.js', import.meta.url), 'utf8');
  const notifications = await readFile(new URL('../src/pages/Notifications.jsx', import.meta.url), 'utf8');
  assert.match(monitor, /selectNewMonitoringDiscoveries\(candidates, existing\)/);
  assert.match(monitor, /sourceUrl: safeMonitoringSourceUrl\(/);
  assert.match(notifications, /safeMonitoringSourceUrl\(item\.sourceUrl\)/);
});
