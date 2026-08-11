const ENVIRONMENT_KEYS = [
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_FOUNDER_PRICE_ID',
  'OPENAI_API_KEY',
];

const previousEnvironment = Object.fromEntries(
  ENVIRONMENT_KEYS.map(key => [key, process.env[key]]),
);
ENVIRONMENT_KEYS.forEach(key => delete process.env[key]);

const originalFetch = globalThis.fetch;
let suppliedApiKey = '';

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('/auth/v1/user')) {
    suppliedApiKey = options.headers?.apikey || '';
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'eyra-auth-test-user' }),
    };
  }
  throw new Error(`Unexpected network request: ${target}`);
};

const { default: handler } = await import('../api/eyra.js');
let statusCode = 200;
let payload = null;

const response = {
  setHeader() {},
  status(code) {
    statusCode = code;
    return this;
  },
  json(value) {
    payload = value;
    return value;
  },
};

try {
  await handler(
    {
      method: 'POST',
      headers: { authorization: 'Bearer valid-test-session' },
      body: { prompt: 'Verify authenticated EYRA routing.' },
    },
    response,
  );

  if (statusCode !== 503 || payload?.error !== 'EYRA AI is not configured.') {
    throw new Error(
      `Expected authentication to succeed before the intentionally missing AI configuration; received ${statusCode}: ${JSON.stringify(payload)}`,
    );
  }
  if (!suppliedApiKey.startsWith('sb_publishable_')) {
    throw new Error('EYRA did not supply the browser-safe Supabase publishable key during token verification.');
  }

  console.log('EYRA authentication configuration regression test passed.');
} finally {
  globalThis.fetch = originalFetch;
  ENVIRONMENT_KEYS.forEach(key => {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  });
}
