import { applyCors, isAllowedBrowserOrigin } from '../src/lib/api-cors.mjs';
import { contactDeliveryConfig } from '../src/lib/contact-readiness.mjs';
const MAX_BODY_BYTES = 12000;
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const htmlEscape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export default async function handler(req, res) {
  if (applyCors(req, res, ["POST"])) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!isAllowedBrowserOrigin(origin, host)) {
    return res.status(403).json({ error: 'Invalid request origin.' });
  }
  const rawSize = Number(req.headers['content-length'] || 0);
  if (rawSize > MAX_BODY_BYTES) return res.status(413).json({ error: 'Request too large.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  // Do not report successful delivery for honeypot submissions: nothing was
  // sent to Resend, and the UI must never claim that an inquiry was delivered.
  if (body.website) return res.status(400).json({ error: 'Unable to submit this form.' });
  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const interest = clean(body.interest, 80);
  const message = clean(body.message, 2400);
  if (name.length < 2 || !validEmail(email) || !['Research & Evidence', 'AI & Engineering', 'Design & Partnerships', 'Other'].includes(interest) || message.length < 20) {
    return res.status(400).json({ error: 'Please complete all fields with valid information.' });
  }
  const delivery = contactDeliveryConfig();
  if (!delivery) {
    return res.status(503).json({ error: 'The contact form is currently unavailable. Please try again later.' });
  }
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${delivery.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: delivery.from,
        to: [delivery.to],
        reply_to: email,
        subject: `EYLO collaboration interest: ${interest}`,
        html: `<h2>EYLO collaboration inquiry</h2><p><b>Name:</b> ${htmlEscape(name)}</p><p><b>Email:</b> ${htmlEscape(email)}</p><p><b>Area:</b> ${htmlEscape(interest)}</p><p><b>Message:</b></p><p style="white-space:pre-wrap">${htmlEscape(message)}</p>`,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!result.ok) {
      console.error('Careers delivery failed:', result.status);
      return res.status(502).json({ error: 'Message could not be delivered. Please try again.' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Careers delivery error:', error instanceof Error ? error.message : 'unknown');
    return res.status(502).json({ error: 'Message could not be delivered. Please try again.' });
  }
}
