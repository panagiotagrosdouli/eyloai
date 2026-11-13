import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPayload, snapshotIdentity, conversationExport } from '../src/lib/eyra-snapshot.mjs';
const messages = [{ role: 'user', content: 'Review methods', timestamp: 1 }, { role: 'eyra', content: 'Inspect supplied source [P1].', timestamp: 2, sources: [{ id: 'P1', url: 'https://doi.org/10.1234/source', title: 'Supplied evidence' }] }];
test('ambiguous snapshot retries retain identity across serialized browser recovery but changed content gets a new ID', async () => {
  const payload = snapshotPayload('Methods', messages);
  const original = await snapshotIdentity(payload, null);
  assert.deepEqual(await snapshotIdentity(payload, JSON.parse(JSON.stringify(original))), original);
  assert.notEqual((await snapshotIdentity(snapshotPayload('Edited title', messages), original)).id, original.id);
  assert.notEqual((await snapshotIdentity(payload, { ...original, id: 'invalid' })).id, original.id);
  assert.equal(original.fingerprint.includes('Review methods'), false, 'retry recovery stores a digest, not prompt text');
});
test('exports preserve source attribution without raw provider metadata and reject unverified citation IDs', () => {
  const result = conversationExport('Methods', messages, '2026-11-13T12:00:00Z');
  assert.equal(result.messages[1].sources[0].id, 'P1');
  assert.equal(result.exported_at, '2026-11-13T12:00:00Z');
  assert.throws(() => conversationExport('Bad', [{ ...messages[1], content: 'Fake [P9]' }]), /citation/);
  assert.throws(() => snapshotPayload('Too long', [{ role: 'user', content: 'x'.repeat(16001) }]), /limit/);
  assert.throws(() => snapshotPayload('Empty', []), /Send a message/);
});
