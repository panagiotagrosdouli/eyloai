import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { workspaceDataError } from '../src/lib/workspace-schema-error.mjs';

test('missing files table reports migration mismatch without exposing raw SQL details', () => {
  const error = workspaceDataError({ code: 'PGRST205', message: "Could not find the table 'public.eylo_files' in the schema cache" });
  assert.equal(error.code, 'WORKSPACE_SCHEMA_MISMATCH');
  assert.equal(error.status, 503);
  assert.match(error.message, /missing a required table/);
  assert.doesNotMatch(error.message, /public\.eylo_files|schema cache/);
});

test('projects.updated_date mismatch is identified without assuming the replacement column', () => {
  const error = workspaceDataError({ code: '42703', message: 'column projects.updated_date does not exist' });
  assert.equal(error.code, 'WORKSPACE_SCHEMA_MISMATCH');
  assert.match(error.message, /database schema mismatch/);
  assert.doesNotMatch(error.message, /updated_at|updated_date/);
});

test('ordinary authentication, network and permission failures keep their original identity', () => {
  for (const error of [
    { code: '42501', message: 'permission denied' },
    { code: 'PGRST116', message: 'not found' },
    { code: 'TIMEOUT', message: 'network timeout' },
  ]) assert.equal(workspaceDataError(error), error);
  assert.equal(workspaceDataError(null), null);
});

test('entity and file adapters apply schema errors, and profile does not silently ignore missing tables', async () => {
  const entity = await readFile(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');
  const files = await readFile(new URL('../src/services/eylo-files.mjs', import.meta.url), 'utf8');
  assert.match(entity, /if \(error\) throw workspaceDataError\(error\)/);
  assert.match(entity, /if \(workspaceDataError\(error\) !== error\) throw workspaceDataError\(error\)/);
  assert.match(files, /if \(error\) throw workspaceDataError\(error\)/);
});
