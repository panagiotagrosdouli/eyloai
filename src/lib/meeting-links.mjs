const JITSI_HOST = 'meet.jit.si';
const ROOM_ID_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

export function normalizeMeetingLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid HTTPS meeting link.');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('Meeting links must use HTTPS and cannot contain embedded credentials.');
  }
  return url.href;
}

export function getEmbeddedJitsiRoom(value) {
  try {
    const url = new URL(normalizeMeetingLink(value));
    if (url.hostname !== JITSI_HOST || url.port || url.search || url.hash) return '';
    const roomId = url.pathname.slice(1);
    return ROOM_ID_PATTERN.test(roomId) ? url.href : '';
  } catch {
    return '';
  }
}

export function createJitsiMeetingLink(randomUUID = globalThis.crypto?.randomUUID?.()) {
  if (typeof randomUUID !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(randomUUID)) {
    throw new Error('Secure room creation is unavailable in this browser. Enter a meeting link from your provider instead.');
  }
  return `https://${JITSI_HOST}/eylo-${randomUUID}`;
}
