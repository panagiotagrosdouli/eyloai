const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function configuredEmail(value) {
  const input = String(value || '').trim();
  const displayAddress = input.match(/<([^<>]+)>/);
  const address = (displayAddress ? displayAddress[1] : input).trim();
  return EMAIL_PATTERN.test(address);
}

export function contactDeliveryConfig(env = process.env) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const to = String(env.CONTACT_TO_EMAIL || '').trim();
  const from = String(env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !configuredEmail(to) || !configuredEmail(from)) return null;
  return { apiKey, to, from };
}
