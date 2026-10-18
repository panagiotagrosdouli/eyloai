const MAX_BYTES = 12_000;
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const emailApi = 'https://api.resend.com/emails';

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const host = req.headers.host || '';
  const origin = req.headers.origin || '';
  if (!host || !origin || (() => { try { return new URL(origin).host !== host; } catch { return true; } })()) {
    return res.status(403).json({ error: 'Invalid request origin.' });
  }
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.RESEND_FROM_EMAIL);
  if (!configured) return res.status(503).json({ error: 'Contact form is not available yet. Please try again later.' });
  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BYTES) return res.status(413).json({ error: 'Message is too large.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const name = clean(body.name, 100);
  const email = clean(body.email, 254);
  const interest = clean(body.interest, 80);
  const message = clean(body.message, 2000);
  if (body.website) return res.status(200).json({ ok: true });
  if (name.length < 2 || !EMAIL.test(email) || message.length < 20 || message.length > 2000 || !['Research & evidence','AI & engineering','Design & partnerships','Other'].includes(interest)) {
    return res.status(400).json({ error: 'Please check the form fields.' });
  }
  const text = ['New EYLO collaboration inquiry', '', 'Name: ' + name, 'Email: ' + email, 'Interest: ' + interest, '', message].join('\\n');
  try {
    const response = await fetch(emailApi, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.CONTACT_TO_EMAIL],
        reply_to: email,
        subject: 'EYLO collaboration inquiry — ' + interest,
        text,
        html: '<h2>EYLO collaboration inquiry</h2><p><b>Name:</b> ' + escapeHtml(name) + '</p><p><b>Email:</b> ' + escapeHtml(email) + '</p><p><b>Interest:</b> ' + escapeHtml(interest) + '</p><p style="white-space:pre-wrap">' + escapeHtml(message) + '</p>',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return res.status(502).json({ error: 'The email service could not accept your message. Please try again.' });
    const result = await response.json();
    if (!result.id) return res.status(502).json({ error: 'Message delivery was not confirmed by the email service.' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'Could not send your message. Please try again.' });
  }
}
