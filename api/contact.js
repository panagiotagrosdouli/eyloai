const MAX_BODY_BYTES = 12000;
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const htmlEscape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host || (() => { try { return new URL(origin).host !== host; } catch { return true; } })()) {
    return res.status(403).json({ error: 'Invalid request origin.' });
  }
  const rawSize = Number(req.headers['content-length'] || 0);
  if (rawSize > MAX_BODY_BYTES) return res.status(413).json({ error: 'Request too large.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (body.website) return res.status(200).json({ ok: true });
  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const interest = clean(body.interest, 80);
  const message = clean(body.message, 2400);
  if (name.length < 2 || !validEmail(email) || !['Research & Evidence', 'AI & Engineering', 'Design & Partnerships', 'Other'].includes(interest) || message.length < 20) {
    return res.status(400).json({ error: 'Please complete all fields with valid information.' });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO_EMAIL || !process.env.RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Applications are temporarily unavailable. Please try again later.' });
  }
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.CONTACT_TO_EMAIL],
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
