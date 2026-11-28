let logs = '';
for await (const chunk of process.stdin) logs += chunk;
const safe = logs
  .split(/\r?\n/)
  .filter(line => /error|constraint|foreign key|deleting user|auth\.users/i.test(line))
  .slice(-80)
  .map(line => line
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi, '[id]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [credential]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[project-key]')
    .replace(/((?:password|token|apikey|connection_string)["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, '$1[redacted]'));

if (!safe.length) {
  console.log('No Auth/PostgreSQL error context matched the bounded sanitizer.');
} else {
  console.log('Sanitized disposable Auth/PostgreSQL error context (synthetic CI only):');
  for (const line of safe) console.log(line);
}
