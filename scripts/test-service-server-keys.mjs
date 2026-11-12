const ENVIRONMENT_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'EYLO_SCHEDULED_MONITORING_ENABLED',
  'EYLO_ANALYTICS_ENABLED',
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
  process.env.VITE_SUPABASE_URL = 'https://monitor-test.supabase.co';

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

  // Valid cron authentication and a valid Supabase server key do not activate
  // scheduled work. Operators must explicitly enable it after deployment
  // verification. The disabled path must not touch the database.
  const disabledResponse = createApiResponse();
  await monitorHandler(
    { method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } },
    disabledResponse,
  );
  if (disabledResponse.statusCode !== 503
      || disabledResponse.payload?.error !== 'Scheduled monitoring is not enabled for this deployment.') {
    throw new Error(`Monitoring without explicit activation did not fail closed: ${JSON.stringify(disabledResponse.payload)}`);
  }
  if (monitorServerHeaders.length) {
    throw new Error('Disabled monitoring unexpectedly accessed Supabase.');
  }

  // The activation flag alone does not bypass cron authentication.
  process.env.EYLO_SCHEDULED_MONITORING_ENABLED = '1';
  const unauthorizedResponse = createApiResponse();
  await monitorHandler({ method: 'GET', headers: {} }, unauthorizedResponse);
  if (unauthorizedResponse.statusCode !== 401
      || unauthorizedResponse.payload?.error !== 'Cron authorization required.') {
    throw new Error(`Monitoring accepted an unauthorized caller: ${JSON.stringify(unauthorizedResponse.payload)}`);
  }

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

  // This mock explicitly exercises the post-acceptance path using disposable configuration.
  process.env.EYLO_ANALYTICS_ENABLED = '1';
  process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_regression_test';
  let analyticsHeaders = {};
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/rest/v1/rpc/get_workspace_analytics')) {
      analyticsHeaders = options.headers || {};
      return mockResponse({
        scope: 'personal',
        institution_name: 'My workspace',
        members: 1,
        ai_actions_this_month: 0,
        generated_at: '2026-11-06T00:00:00Z',
        counts: {
          projects: 0,
          saved_papers: 0,
          saved_researchers: 0,
          saved_opportunities: 0,
          meetings: 0,
          watchlists: 0,
        },
      });
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
    throw new Error(`Authenticated workspace analytics failed: ${JSON.stringify(analyticsResponse.payload)}`);
  }
  if (!analyticsHeaders.apikey?.startsWith('sb_publishable_')) {
    throw new Error('Workspace analytics did not use the browser-safe publishable key.');
  }
  if (analyticsHeaders.apikey === modernServerKey) {
    throw new Error('Workspace analytics exposed a Supabase server key.');
  }
  if (analyticsHeaders.authorization !== 'Bearer valid-user-session') {
    throw new Error('Workspace analytics did not forward the authenticated user session.');
  }

  console.log('Modern Supabase server-key regression tests passed.');
} finally {
  globalThis.fetch = originalFetch;
  ENVIRONMENT_KEYS.forEach(key => {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  });
}
