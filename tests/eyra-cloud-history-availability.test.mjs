import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('EYRA never advertises cloud snapshot saving before confirmed conversation listing', () => {
  assert.match(source, /const \[historyAvailability, setHistoryAvailability\] = useState\('checking'\)/);
  assert.match(source, /setSavedConversations\(rows\); setHistoryAvailability\('available'\)/);
  assert.match(source, /historyAvailability !== 'available' \|\| loading \|\| savingConversation \|\| historyBusy/);
  assert.match(source, /disabled=\{historyAvailability !== 'available' \|\| loading \|\| savingConversation \|\| historyBusy\}/);
});

test('failed cloud history preserves usable EYRA chat and export with retry', () => {
  assert.match(source, /setHistoryAvailability\('unavailable'\)/);
  assert.match(source, /Cloud conversation saving is unavailable/);
  assert.match(source, /Check cloud history again/);
  assert.match(source, /onClick=\{\(\) => void retrySavedConversations\(\)\}/);
  assert.match(source, /onClick=\{exportConversation\}/);
  assert.match(source, /const retrySavedConversations = async/);
});

test('retry and account switching do not apply stale conversation results', () => {
  assert.match(source, /historyEpochRef\.current \+= 1/);
  assert.match(source, /const epoch = \+\+historyEpochRef\.current/);
  assert.match(source, /ownerRef\.current !== owner \|\| historyEpochRef\.current !== epoch/);
  assert.match(source, /setSavedConversations\(\[\]\); setHistoryAvailability\('checking'\)/);
  assert.match(source, /historyWriteLockRef\.current/);
});
