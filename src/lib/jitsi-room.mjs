const JITSI_ORIGIN = 'https://meet.jit.si';

export function createJitsiRoomUrl(cryptoProvider = globalThis.crypto) {
  let id;

  if (typeof cryptoProvider?.randomUUID === 'function') {
    id = cryptoProvider.randomUUID();
  } else if (typeof cryptoProvider?.getRandomValues === 'function') {
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(24));
    id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    throw new Error('Secure room creation is unavailable in this browser. Open EYLO over HTTPS and try again.');
  }

  const safeId = String(id).replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeId) throw new Error('A secure meeting room could not be created. Please try again.');
  return `${JITSI_ORIGIN}/eylo-${safeId}`;
}

export function isPublicJitsiRoomUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'meet.jit.si'
      && /^\/[a-zA-Z0-9-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
