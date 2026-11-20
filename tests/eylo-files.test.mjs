import test from 'node:test';
import assert from 'node:assert/strict';
import { createEyloFilesService } from '../src/services/eylo-files.mjs';
import { EYLO_FILE_MAX_BYTES, filterEyloFiles, safeStorageFilename, validateEyloFile } from '../src/lib/eylo-files.mjs';

function fakeSupabase({ userId = 'user-a', signedIn = true } = {}) {
  const tables = { eylo_files: [], eylo_file_versions: [] };
  const objects = new Map();
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: userId } : null }, error: null }) },
    from(table) { return new Query(client, table); },
    storage: { from() {
      return {
        upload: async (path, file) => {
          if (objects.has(path)) return { error: new Error('Object already exists') };
          objects.set(path, file); return { error: null };
        },
        download: async path => objects.has(path)
          ? { data: objects.get(path), error: null }
          : { data: null, error: new Error('Object not found') },
        remove: async paths => {
          if (paths.length > 1000) return { error: new Error('Storage allows at most 1000 objects per request') };
          paths.forEach(path => objects.delete(path)); return { error: null };
        },
      };
    } },
  };
  return { client, tables, objects };
}

class Query {
  constructor(client, table) { this.client = client; this.table = table; this.action = 'select'; this.filters = []; this.orders = []; this.max = 1000; this.start = 0; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
  order(key, { ascending = true } = {}) { this.orders.push([key, ascending]); return this; }
  limit(count) { this.max = count; return this; }
  range(start, end) { this.start = start; this.max = end - start + 1; return this; }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
  update(payload) { this.action = 'update'; this.payload = payload; return this; }
  delete() { this.action = 'delete'; return this; }
  single() { return this.execute(true, false); }
  maybeSingle() { return this.execute(true, true); }
  then(resolve, reject) { return this.execute(false, false).then(resolve, reject); }
  async execute(single, optional) {
    const rows = this.client.__tables[this.table];
    const userId = (await this.client.auth.getUser()).data.user?.id;
    const visible = () => rows.filter(row => row.user_id === userId && this.filters.every(filter => filter(row)));
    if (this.action === 'insert') {
      const inserted = Array.isArray(this.payload) ? this.payload : [this.payload];
      rows.push(...inserted.map(row => ({ created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row })));
      const result = inserted.map(row => rows.find(candidate => candidate.id === row.id));
      return { data: single ? result[0] : result, error: null };
    }
    let found = visible();
    found.sort((a, b) => {
      for (const [key, ascending] of this.orders) {
        if (a[key] === b[key]) continue;
        return (a[key] ?? 0) < (b[key] ?? 0) ? (ascending ? -1 : 1) : (ascending ? 1 : -1);
      }
      return 0;
    });
    found = found.slice(this.start, this.start + this.max);
    if (this.action === 'update') found.forEach(row => Object.assign(row, this.payload));
    if (this.action === 'delete') {
      this.client.__tables[this.table] = rows.filter(row => !found.includes(row));
    }
    if (single) {
      if (!found.length && optional) return { data: null, error: null };
      if (found.length !== 1) return { data: null, error: new Error('Expected one row') };
      return { data: found[0], error: null };
    }
    return { data: found, error: null };
  }
}

function testClient(options) {
  const setup = fakeSupabase(options);
  setup.client.__tables = setup.tables;
  return setup;
}

const file = (name, content = 'example') => ({ name, type: 'text/plain', size: content.length, content });

test('EYLO Files validates bounded supported files and sanitizes storage names', () => {
  assert.deepEqual(validateEyloFile(file('notes.txt')), { name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 7 });
  assert.equal(safeStorageFilename('../notes/plan.txt').includes('/'), false);
  assert.throws(() => validateEyloFile({ ...file('large.txt'), size: EYLO_FILE_MAX_BYTES + 1 }), /25 MB/);
  assert.throws(() => validateEyloFile({ ...file('script.exe'), type: 'application/x-msdownload' }), /not supported/);
  assert.deepEqual(filterEyloFiles([{ name: 'Protocol', description: 'methods' }, { name: 'Budget' }], 'method').map(item => item.name), ['Protocol']);
});

test('upload persists a private file and reload restores its version history', async () => {
  const { client, objects } = testClient();
  const service = createEyloFilesService(client);
  const saved = await service.upload(file('study.txt', 'draft'));
  assert.equal(saved.versions[0].version_number, 1);
  assert.equal(objects.size, 1);
  assert.ok([...objects.keys()][0].startsWith('user-a/'));
  const reloaded = await createEyloFilesService(client).list();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].name, 'study.txt');
  assert.equal(reloaded[0].versions[0].id, saved.versions[0].id);
});

test('new versions preserve prior content and can be individually downloaded', async () => {
  const { client, objects } = testClient();
  const service = createEyloFilesService(client);
  const saved = await service.upload(file('study.txt', 'draft'));
  await service.addVersion(saved.id, file('study.txt', 'revised'));
  const [reloaded] = await service.list();
  assert.deepEqual(reloaded.versions.map(version => version.version_number), [2, 1]);
  assert.equal((await service.download(reloaded.versions[0])).content, 'revised');
  assert.equal((await service.download(reloaded.versions[1])).content, 'draft');
  assert.equal(objects.size, 2);
});

test('an exact document remains retrievable outside the recent 500-file listing and is owner scoped', async () => {
  const { client } = testClient();
  const service = createEyloFilesService(client);
  const saved = await service.upload(file('older.md', 'older draft'));
  client.__tables.eylo_files.find(row => row.id === saved.id).updated_at = '2020-01-01T00:00:00Z';
  for (let index = 0; index < 500; index += 1) {
    client.__tables.eylo_files.push({ id: `recent-${index}`, user_id: 'user-a', name: 'recent.txt', updated_at: '2026-11-12T00:00:00Z' });
  }
  assert.equal((await service.list()).some(row => row.id === saved.id), false);
  assert.equal((await service.get(saved.id)).versions[0].id, saved.versions[0].id);
  client.auth.getUser = async () => ({ data: { user: { id: 'user-b' } }, error: null });
  await assert.rejects(() => service.get(saved.id));
});

test('user scoping and sign-in are required for retrieval and deletion', async () => {
  const { client, objects } = testClient();
  const userA = createEyloFilesService(client);
  const saved = await userA.upload(file('private.txt'));
  const userB = createEyloFilesService(client);
  client.auth.getUser = async () => ({ data: { user: { id: 'user-b' } }, error: null });
  assert.deepEqual(await userB.list(), []);
  await assert.rejects(() => userB.remove(saved.id), /not found or access was denied/);
  assert.equal(objects.size, 1);
  client.auth.getUser = async () => ({ data: { user: null }, error: null });
  await assert.rejects(() => userB.list(), error => error.code === 'AUTHENTICATION_REQUIRED');
});

test('remove deletes all stored versions before metadata and returns an empty library', async () => {
  const { client, objects } = testClient();
  const service = createEyloFilesService(client);
  const saved = await service.upload(file('study.txt', 'v1'));
  await service.addVersion(saved.id, file('study.txt', 'v2'));
  await service.remove(saved.id);
  assert.equal(objects.size, 0);
  assert.deepEqual(await service.list(), []);
});

test('metadata failure after version insertion preserves the immutable version and its file bytes', async () => {
  const { client, objects } = testClient();
  const service = createEyloFilesService(client);
  const saved = await service.upload(file('study.txt', 'original'));
  const originalFrom = client.from.bind(client);
  client.from = table => {
    const query = originalFrom(table);
    if (table === 'eylo_files') query.update = () => {
      query.execute = async () => ({ data: null, error: new Error('Metadata unavailable') });
      return query;
    };
    return query;
  };
  await assert.rejects(() => service.addVersion(saved.id, file('study.txt', 'recoverable revision')),
    error => error.code === 'FILE_VERSION_METADATA_FAILED' && /stored/.test(error.message));
  const reloaded = await service.get(saved.id);
  assert.equal(reloaded.versions.length, 2);
  assert.equal(objects.size, 2);
  assert.equal((await service.download(reloaded.versions[0])).content, 'recoverable revision');
});


function seedVersionHistory(count) {
  const setup = testClient();
  setup.tables.eylo_files.push({ id: 'large-history', user_id: 'user-a', name: 'history.txt', updated_at: '2026-11-20T00:00:00Z' });
  for (let number = 1; number <= count; number++) {
    const path = `user-a/large-history/version-${number}`;
    setup.tables.eylo_file_versions.push({ id: `version-${number}`, user_id: 'user-a', file_id: 'large-history', version_number: number, storage_path: path });
    setup.objects.set(path, file('history.txt', `revision ${number}`));
  }
  return setup;
}

test('exact file history loads beyond the PostgREST row cap and retains newest-to-oldest order', async () => {
  const { client } = seedVersionHistory(1005);
  const saved = await createEyloFilesService(client).get('large-history');
  assert.equal(saved.versions.length, 1005);
  assert.equal(saved.versions[0].version_number, 1005);
  assert.equal(saved.versions.at(-1).version_number, 1);
});

test('listing preserves complete version histories beyond the shared response row cap', async () => {
  const { client } = seedVersionHistory(1005);
  const [saved] = await createEyloFilesService(client).list();
  assert.equal(saved.versions.length, 1005);
  assert.equal(saved.latest_version_id, 'version-1005');
});

test('deletion removes bytes for every version beyond the PostgREST row cap', async () => {
  const { client, objects } = seedVersionHistory(1005);
  await createEyloFilesService(client).remove('large-history');
  assert.equal(objects.size, 0, 'no old Storage objects survive because a metadata read was truncated');
});

test('failed later history pages abort deletion before any Storage removal', async () => {
  const { client, objects } = seedVersionHistory(1005);
  const original = client.from.bind(client);
  client.from = table => {
    const query = original(table);
    const range = query.range.bind(query);
    query.range = (start, end) => {
      range(start, end);
      if (start >= 200) query.execute = async () => ({ data: null, error: new Error('History page unavailable') });
      return query;
    };
    return query;
  };
  await assert.rejects(createEyloFilesService(client).remove('large-history'), /History page unavailable/);
  assert.equal(objects.size, 1005);
  assert.equal(client.__tables.eylo_files.length, 1);
});


test('file selections batch version IDs to avoid oversized PostgREST filter URLs', async () => {
  const { client, tables } = testClient();
  for (let index = 0; index < 120; index++) {
    const id = `file-${index}`;
    tables.eylo_files.push({ id, user_id: 'user-a', name: id, updated_at: '2026-11-20' });
    tables.eylo_file_versions.push({ id: `version-${index}`, user_id: 'user-a', file_id: id, version_number: 1 });
  }
  const sizes = [];
  const original = client.from.bind(client);
  client.from = table => {
    const query = original(table);
    const filter = query.in.bind(query);
    query.in = (field, values) => { if (table === 'eylo_file_versions') sizes.push(values.length); return filter(field, values); };
    return query;
  };
  const listed = await createEyloFilesService(client).list();
  assert.equal(listed.length, 120);
  assert.ok(listed.every(item => item.versions.length === 1));
  assert.deepEqual(sizes, [50, 50, 20]);
});

test('excessive version history fails explicitly before destructive work rather than truncating', async () => {
  const { client, objects } = seedVersionHistory(10001);
  await assert.rejects(createEyloFilesService(client).remove('large-history'), /safety limit/);
  assert.equal(objects.size, 10001);
  assert.equal(client.__tables.eylo_files.length, 1);
});

test('a failed Storage batch keeps metadata and reports an incomplete deletion that can be retried', async () => {
  const { client } = seedVersionHistory(1005);
  const storage = client.storage.from.bind(client.storage);
  let batches = 0;
  client.storage.from = bucket => ({ ...storage(bucket), remove: async () => {
    batches++;
    return batches === 2 ? { error: new Error('temporary Storage outage') } : { error: null };
  } });
  await assert.rejects(createEyloFilesService(client).remove('large-history'), error => error.code === 'FILE_DELETE_INCOMPLETE');
  assert.equal(batches, 2);
  assert.equal(client.__tables.eylo_files.length, 1);
});
