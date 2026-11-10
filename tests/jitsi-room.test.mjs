import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJitsiRoomUrl, isPublicJitsiRoomUrl } from '../src/lib/jitsi-room.mjs';

test('Jitsi room links use the configured host and a cryptographically random ID', () => {
  const room = createJitsiRoomUrl({ randomUUID: () => '123e4567-e89b-12d3-a456-426614174000' });
  assert.equal(room, 'https://meet.jit.si/eylo-123e4567-e89b-12d3-a456-426614174000');
  assert.equal(isPublicJitsiRoomUrl(room), true);
});

test('Jitsi room IDs retain a cryptographic fallback when randomUUID is unavailable', () => {
  const cryptoProvider = {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    },
  };
  const room = createJitsiRoomUrl(cryptoProvider);
  assert.equal(room, `https://meet.jit.si/eylo-${'ab'.repeat(24)}`);
});

test('room creation fails closed when a secure random source is unavailable', () => {
  assert.throws(() => createJitsiRoomUrl(null), /Secure room creation is unavailable/);
});

test('only HTTPS single-room Jitsi URLs are embedded', () => {
  assert.equal(isPublicJitsiRoomUrl('https://meet.jit.si/eylo-room-123'), true);
  assert.equal(isPublicJitsiRoomUrl('http://meet.jit.si/room'), false);
  assert.equal(isPublicJitsiRoomUrl('https://evil.example/room'), false);
  assert.equal(isPublicJitsiRoomUrl('https://meet.jit.si/room?redirect=https://evil.example'), true);
  assert.equal(isPublicJitsiRoomUrl('https://meet.jit.si/room/extra'), false);
});

test('meeting UI discloses public room access and does not use weak random fallback', async () => {
  const form = await readFile(new URL('../src/components/meetings/MeetingForm.jsx', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../src/components/meetings/MeetingDetail.jsx', import.meta.url), 'utf8');
  assert.match(form, /Anyone who obtains the room link may be able to join/);
  assert.match(detail, /EYLO does not enforce an invite list/);
  assert.doesNotMatch(form, /Math\.random/);
});
