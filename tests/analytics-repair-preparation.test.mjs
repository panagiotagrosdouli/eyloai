import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildAnalyticsRepairSql, verifyEmptyCliMigration, writeCliMigration,
} from '../scripts/prepare-analytics-repair.mjs';

const source = readFileSync(new URL('../supabase/migrations/20260817090600_analytics_rpc_boundary.sql', import.meta.url), 'utf8');

test('the actual corrected Analytics gateway is safe to package as a new migration', () => {
  const sql = buildAnalyticsRepairSql(source);
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /from public\.profiles\s+where user_id = requester/i);
  assert.match(sql, /data\s*->>\s*'full_name'/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /security invoker\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function private\.get_workspace_analytics_internal\(\) from public, anon/i);
  assert.match(sql, /revoke all on function public\.get_workspace_analytics\(\) from public, anon/i);
  assert.doesNotMatch(sql, /from public\.profiles\s+where id = requester/i);
});

test('a missing authorization boundary or destructive SQL stops migration preparation', () => {
  assert.throws(
    () => buildAnalyticsRepairSql(source.replace('security invoker', 'security definer')),
    /security contract/,
  );
  assert.throws(
    () => buildAnalyticsRepairSql(source + '\ndrop table public.profiles;'),
    /destructive/,
  );
});

test('only an empty CLI-created, correctly named SQL file can be populated', () => {
  const root = mkdtempSync(join(tmpdir(), 'eylo-analytics-repair-'));
  const migrations = join(root, 'supabase', 'migrations');
  mkdirSync(migrations, { recursive: true });
  try {
    const name = '20261106060000_fix_analytics_profile_schema.sql';
    const file = join(migrations, name);
    writeFileSync(file, '');
    assert.equal(verifyEmptyCliMigration(file, root), file);
    const result = writeCliMigration(file, source, root);
    assert.equal(result, file);
    assert.match(readFileSync(file, 'utf8'), /private\.get_workspace_analytics_internal/);
    assert.throws(() => writeCliMigration(file, source, root), /Refusing to overwrite/);
    assert.throws(() => writeCliMigration(join(migrations, '20261106060001_other.sql'), source, root), /CLI-created/);
    const other = join(root, name);
    writeFileSync(other, '');
    assert.throws(() => verifyEmptyCliMigration(other, root), /CLI-created/);
    const linked = join(migrations, '20261106060002_fix_analytics_profile_schema.sql');
    symlinkSync(file, linked);
    assert.throws(() => verifyEmptyCliMigration(linked, root), /non-symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
