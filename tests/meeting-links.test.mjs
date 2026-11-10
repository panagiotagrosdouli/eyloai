import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeMeetingLink } from '../src/lib/meeting-links.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('meeting links accept HTTPS URLs and reject unsafe schemes or embedded credentials', () => {
  assert.equal(normalizeMeetingLink('  https://meet.example.org/room  '), 'https://meet.example.org/room');
  assert.equal(normalizeMeetingLink(''), '');
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'http://meet.example.org/room', 'https://user:pass@meet.example.org/room']) {
    assert.throws(() => normalizeMeetingLink(value), /HTTPS|credentials/);
  }
});

test('meeting cards use keyboard-operable controls and keep meeting links outside the details button', () => {
  const source = read('src/components/meetings/MeetingCard.jsx');
  assert.match(source, /<article\b/);
  assert.match(source, /<button type="button" onClick=\{onClick\}/);
  assert.match(source, /aria-label=\{`Open meeting plan: \$\{meeting\.title\}`\}/);
  assert.match(source, /aria-label=\{`Open external meeting room for \$\{meeting\.title\} \(opens in a new tab\)`\}/);
  const buttonContents = source.match(/<button\b[^>]*>([\s\S]*?)<\/button>/)?.[1] || '';
  assert.doesNotMatch(buttonContents, /<a\b/);
});

test('new meeting flows create native rooms and historical external links remain available', () => {
  const form = read('src/components/meetings/MeetingForm.jsx');
  const detail = read('src/components/meetings/MeetingDetail.jsx');
  const room = read('src/components/meetings/MeetingRoom.jsx');
  assert.match(form, /native_video: true/);
  assert.match(detail, /Open call externally/);
  assert.match(detail, /Start EYLO meeting/);
  assert.match(room, /\/api\/meeting-room/);
  assert.doesNotMatch(form + detail, /meet\.jit\.si|createJitsiRoom/);
});
