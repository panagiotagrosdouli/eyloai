// Synthetic Auth/PostgREST transport for CLI tests; no real network or credentials.
import assert from 'node:assert/strict';
import { WORKSPACE_EXPORT_TABLES } from '../../src/lib/workspace-export.mjs';
const mode = process.argv[2];
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
globalThis.fetch = async (resource, options) => {
  const url = new URL(String(resource));
  assert.equal(url.origin, 'https://abcdefghijklmnopqrst.supabase.co');
  if (url.pathname === '/auth/v1/token') {
    const email = JSON.parse(options.body).email;
    const index = email === 'fixture-a@example.invalid' || mode === 'same-user' ? 0 : 1;
    return Response.json({ access_token: `fixture-token-${index}`, user: { id: ids[index] } });
  }
  const table = url.pathname.split('/').at(-1);
  assert.ok(['profiles', ...WORKSPACE_EXPORT_TABLES].includes(table));
  assert.equal(options.method, undefined, 'RLS smoke must not mutate user rows');
  const caller = options.headers.authorization === 'Bearer fixture-token-0' ? ids[0] : ids[1];
  const requested = url.searchParams.get('user_id').slice(3);
  if (mode === 'wrong-owner' && table === 'profiles' && requested === caller) return Response.json([{ user_id: ids[1] }]);
  if (mode === 'leak' && table === 'notes' && requested !== caller) return Response.json([{ user_id: requested }]);
  if (mode === 'one-sided' && table !== 'profiles' && caller === ids[1]) return Response.json([]);
  return Response.json(requested === caller ? [{ user_id: caller }] : []);
};
await import('../../scripts/verify-rls-two-accounts.mjs');
