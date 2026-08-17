const ENVIRONMENT_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
];

const previousEnvironment = Object.fromEntries(
  ENVIRONMENT_KEYS.map(key => [key, process.env[key]]),
);
ENVIRONMENT_KEYS.forEach(key => delete process.env[key]);

const originalFetch = globalThis.fetch;
const modernServerKey = 'sb_secret_server_key_regression_test';

function mockResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function createApiResponse() {
  return {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return value;
    },
  };
}

try {
  process.env.SUPABASE_SECRET_KEY = modernServerKey;
  process.env.CRON_SECRET = 'cron-regression-test';

  const monitorServerHeaders = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/rest/v1/watchlists') || target.includes('/rest/v1/monitoring_discoveries')) {
      monitorServerHeaders.push(options.headers || {});
      return mockResponse([]);
    }
    throw new Error(`Unexpected monitoring request: ${target}`);
  };

  const { default: monitorHandler } = await import('../api/monitor.js');
  const monitorResponse = createApiResponse();
  await monitorHandler(
    { method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } },
    monitorResponse,
  );

  if (monitorResponse.statusCode !== 200 || monitorResponse.payload?.checked !== 0) {
    throw new Error(`Modern Supabase secret did not activate monitoring: ${JSON.stringify(monitorResponse.payload)}`);
  }
  if (!monitorServerHeaders.length || monitorServerHeaders.some(headers => headers.apikey !== modernServerKey)) {
    throw new Error('Monitoring did not use the modern Supabase secret as the apikey.');
  }
  if (monitorServerHeaders.some(headers => headers.authorization)) {
    throw new Error('Monitoring incorrectly exposed a modern Supabase secret as a Bearer token.');
  }

  let authApiKey = '';
  const analyticsServerHeaders = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) {
      authApiKey = options.headers?.apikey || '';
      return mockResponse({ id: 'institution-admin-user' });
    }
    if (target.includes('/rest/v1/profiles?user_id=')) {
      analyticsServerHeaders.push(options.headers || {});
      return mockResponse([{ data: {
        subscription_tier: 'institution',
        organization_role: 'institution_admin',
        institution_id: 'institution-regression-test',
        organization: 'Test Institution',
      } }]);
    }
    if (target.includes('/rest/v1/profiles?select=')) {
      analyticsServerHeaders.push(options.headers || {});
      return mockResponse([{ user_id: 'institution-admin-user', data: { institution_id: 'institution-regression-test' } }]);
    }
    if (target.includes('/rest/v1/')) {
      analyticsServerHeaders.push(options.headers || {});
      return mockResponse([]);
    }
    throw new Error(`Unexpected analytics request: ${target}`);
  };

  const { default: analyticsHandler } = await import('../api/admin-analytics.js');
  const analyticsResponse = createApiResponse();
  await analyticsHandler(
    { method: 'GET', headers: { authorization: 'Bearer valid-user-session' } },
    analyticsResponse,
  );

  if (analyticsResponse.statusCode !== 200 || analyticsResponse.payload?.members !== 1) {
    throw new Error(`Modern Supabase secret did not activate institution analytics: ${JSON.stringify(analyticsResponse.payload)}`);
  }
  if (!authApiKey.startsWith('sb_publishable_')) {
    throw new Error('Institution analytics did not use the browser-safe publishable key for user authentication.');
  }
  if (!analyticsServerHeaders.length || analyticsServerHeaders.some(headers => headers.apikey !== modernServerKey)) {
    throw new Error('Institution analytics did not use the modern Supabase secret as the apikey.');
  }
  if (analyticsServerHeaders.some(headers => headers.authorization)) {
    throw new Error('Institution analytics incorrectly exposed a modern Supabase secret as a Bearer token.');
  }

  console.log('Modern Supabase server-key regression tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  ENVIRONMENT_KEYS.forEach(key => {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  });
}
