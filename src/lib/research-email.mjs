const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value) {
  const email = String(value || '').trim();
  const separator = email.lastIndexOf('@');
  if (separator <= 0) return false;
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return email.length <= 254 && localPart.length <= 64 && domain.length <= 253 && EMAIL_PATTERN.test(email);
}

export function parseResearchEmailDraft(draft) {
  const text = String(draft || '');
  const lines = text.split(/\r?\n/);
  const hasSubject = lines[0]?.startsWith('Subject:') || false;
  return {
    subject: hasSubject ? lines[0].slice(8).trim() : 'Research inquiry',
    body: hasSubject ? lines.slice(2).join('\n') : text,
  };
}
