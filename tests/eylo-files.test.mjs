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
        remove: async paths => { paths.forEach(path => objects.delete(path)); return { error: null }; },
      };
    } },
  };
  return { client, tables, objects };
}

class Query {
  constructor(client, table) { this.client = client; this.table = table; this.action = 'select'; this.filters = []; this.orders = []; this.max = Infinity; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
  order(key, { ascending = true } = {}) { this.orders.push([key, ascending]); return this; }
  limit(count) { this.max = count; return this; }
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
    for (const [key, ascending] of this.orders) found.sort((a, b) => (a[key] ?? 0) < (b[key] ?? 0) ? (ascending ? -1 : 1) : (ascending ? 1 : -1));
    found = found.slice(0, this.max);
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
