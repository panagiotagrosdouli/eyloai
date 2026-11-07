const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(value) {
  const email = String(value || '').trim();
  return email.length <= 254 && EMAIL_PATTERN.test(email);
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
