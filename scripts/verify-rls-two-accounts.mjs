// Read-only owner-isolation smoke check. Run only with two explicitly authorized disposable accounts.
// Credentials must be provided through protected environment variables, never committed.
const intendedUrl = 'https://kbzjngpzxpniaumlupaa.supabase.co';
const suppliedUrl = process.env.EYLO_RLS_SUPABASE_URL;
const apiKey = process.env.EYLO_RLS_PUBLISHABLE_KEY;
const accounts = [
  { email: process.env.EYLO_RLS_TEST_A_EMAIL, password: process.env.EYLO_RLS_TEST_A_PASSWORD },
  { email: process.env.EYLO_RLS_TEST_B_EMAIL, password: process.env.EYLO_RLS_TEST_B_PASSWORD },
];

if (suppliedUrl !== intendedUrl || !apiKey || accounts.some(({ email, password }) => !email || !password)) {
  throw new Error('RLS verification blocked: intended project URL and two authorized disposable accounts are required.');
}

const timeout = () => AbortSignal.timeout(10_000);
async function request(path, options = {}) {
  const response = await fetch(`${intendedUrl}${path}`, { ...options, signal: timeout() });
  if (!response.ok) throw new Error(`RLS test request failed with HTTP ${response.status}`);
  return response.json();
}

async function signIn({ email, password }) {
  const data = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!data?.access_token || !data?.user?.id) throw new Error('Disposable test account sign-in failed.');
  return { userId: data.user.id, accessToken: data.access_token };
}

async function rows(identity, table, userId) {
  const query = new URLSearchParams({ select: 'user_id', user_id: `eq.${userId}`, limit: '1' });
  const data = await request(`/rest/v1/${table}?${query}`, {
    headers: { apikey: apiKey, authorization: `Bearer ${identity.accessToken}` },
  });
  if (!Array.isArray(data)) throw new Error('Unexpected database response.');
  return data;
}

const [a, b] = await Promise.all(accounts.map(signIn));
if (a.userId === b.userId) throw new Error('Two distinct disposable accounts are required.');
const tables = ['profiles', 'projects', 'saved_papers', 'saved_researchers', 'saved_opportunities', 'meetings', 'watchlists'];
let checked = 0;
let inconclusive = 0;
for (const table of tables) {
  const [ownA, ownB, foreignA, foreignB] = await Promise.all([
    rows(a, table, a.userId), rows(b, table, b.userId),
    rows(a, table, b.userId), rows(b, table, a.userId),
  ]);
  if (foreignA.length || foreignB.length) throw new Error(`Cross-account data exposure detected in ${table}`);
  if (table === 'profiles' && (!ownA.length || !ownB.length)) {
    throw new Error('Both disposable accounts require their own profile rows to establish the isolation fixture.');
  }
  if (!ownA.length && !ownB.length) inconclusive += 1;
  else checked += 1;
  console.log(`${table}: cross-account reads denied; own-row fixture ${ownA.length || ownB.length ? 'present' : 'absent'}`);
}
console.log(`Read-only RLS test finished: ${checked} table(s) with owner-row evidence, ${inconclusive} inconclusive empty table(s).`);
