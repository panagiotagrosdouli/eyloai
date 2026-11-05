// An optional, server-enforced early-access cap independent of Stripe billing.
// Once set, a missing or invalid value must NEVER silently grant unlimited AI.
export function earlyAccessUsageLimit(env = process.env) {
  const raw = env.EYRA_EARLY_ACCESS_MONTHLY_LIMIT;
  if (raw === undefined || raw === null || raw === '') return null;
  if (!/^[1-9][0-9]{0,4}$/.test(String(raw).trim())) {
    throw new Error('Invalid EYRA_EARLY_ACCESS_MONTHLY_LIMIT; expected an integer from 1 to 99999.');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > 99999) {
    throw new Error('EYRA early access quota must be between 1 and 99999.');
  }
  return value;
}
