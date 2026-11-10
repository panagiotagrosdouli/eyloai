import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJitsiMeetingLink, getEmbeddedJitsiRoom, normalizeMeetingLink } from '../src/lib/meeting-links.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('meeting links accept HTTPS URLs and reject unsafe schemes or embedded credentials', () => {
  assert.equal(normalizeMeetingLink('  https://meet.example.org/room  '), 'https://meet.example.org/room');
  assert.equal(normalizeMeetingLink(''), '');
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'http://meet.example.org/room', 'https://user:pass@meet.example.org/room']) {
    assert.throws(() => normalizeMeetingLink(value), /HTTPS|credentials/);
  }
});

test('Jitsi room creation requires a well-formed random UUID and embeds only the public Jitsi host', () => {
  const link = createJitsiMeetingLink('2f7e7f00-a7c9-4ee4-8c5e-d375f5e1f902');
  assert.equal(link, 'https://meet.jit.si/eylo-2f7e7f00-a7c9-4ee4-8c5e-d375f5e1f902');
  assert.equal(getEmbeddedJitsiRoom(link), link);
  assert.equal(getEmbeddedJitsiRoom('https://meet.jit.si/room-123?config.test=true'), '');
  assert.equal(getEmbeddedJitsiRoom('https://evil.example/room-123'), '');
  assert.throws(() => createJitsiMeetingLink('not-random-enough'), /Secure room creation/);
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
