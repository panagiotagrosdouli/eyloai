import { File } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createEyloFilesService } from '../src/services/eylo-files.mjs';
import { validateEyloStorageStagingConfig } from './eylo-file-storage-staging-core.mjs';

const config = validateEyloStorageStagingConfig(process.env);
if (!config.ok) {
  console.error('Storage staging acceptance blocked: ' + config.errors.join(' '));
  process.exitCode = 2;
} else {
  const key = process.env.EYLO_STORAGE_PUBLISHABLE_KEY;
  const makeClient = () => createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const clientA = makeClient();
  const clientB = makeClient();
  const filesA = createEyloFilesService(clientA);
  const filesB = createEyloFilesService(clientB);
  let fileId = null;
  let ownerId = null;
  const storagePaths = new Set();
  let failed = null;
  let result = null;
  try {
    const [loginA, loginB] = await Promise.all([
      clientA.auth.signInWithPassword({ email: process.env.EYLO_STORAGE_TEST_A_EMAIL, password: process.env.EYLO_STORAGE_TEST_A_PASSWORD }),
      clientB.auth.signInWithPassword({ email: process.env.EYLO_STORAGE_TEST_B_EMAIL, password: process.env.EYLO_STORAGE_TEST_B_PASSWORD }),
    ]);
    if (loginA.error || !loginA.data?.user?.id || loginB.error || !loginB.data?.user?.id) throw new Error('Disposable staging account authentication failed.');
    if (loginA.data.user.id === loginB.data.user.id) throw new Error('Two distinct staging account identities are required.');
    ownerId = loginA.data.user.id;

    const marker = `eylo-staging-storage-${randomUUID()}`;
    const initialText = `${marker}:version-one`;
    const nextText = `${marker}:version-two`;
    const initialFile = new File([initialText], `${marker}.txt`, { type: 'text/plain' });
    const saved = await filesA.upload(initialFile, { description: 'Disposable staging Storage isolation acceptance fixture.' });
    fileId = saved?.id;
    if (!fileId || saved.user_id !== loginA.data.user.id || saved.versions?.length !== 1) throw new Error('Owner upload did not return a verified file receipt.');
    storagePaths.add(saved.versions[0].storage_path);

    const initialBytes = await (await filesA.download(saved.versions[0])).text();
    if (initialBytes !== initialText) throw new Error('Owner download bytes did not match the uploaded fixture.');

    const ownerList = await filesA.list({ query: marker });
    const foreignList = await filesB.list({ query: marker });
    if (!ownerList.some(item => item.id === fileId && item.user_id === loginA.data.user.id)) throw new Error('Owner cannot reload the saved file and version.');
    if (foreignList.some(item => item.id === fileId)) throw new Error('Cross-account Storage metadata exposure detected.');

    const [foreignMetadata, foreignVersions, foreignBytes, foreignUpdate, foreignDelete] = await Promise.all([
      clientB.from('eylo_files').select('id,user_id').eq('id', fileId),
      clientB.from('eylo_file_versions').select('id,user_id,storage_path').eq('id', saved.versions[0].id),
      clientB.storage.from('eylo-files').download(saved.versions[0].storage_path),
      clientB.from('eylo_files').update({ description: 'Unauthorized staging attempt.' }).eq('id', fileId).select('id'),
      clientB.from('eylo_files').delete().eq('id', fileId).select('id'),
    ]);
    if (foreignMetadata.data?.length || foreignVersions.data?.length || foreignBytes.data || foreignUpdate.data?.length || foreignDelete.data?.length) {
      throw new Error('A cross-account Storage read, update or delete unexpectedly succeeded.');
    }
    if (!(foreignMetadata.error || foreignVersions.error || foreignBytes.error || foreignUpdate.error || foreignDelete.error
      || (Array.isArray(foreignMetadata.data) && foreignMetadata.data.length === 0))) {
      throw new Error('Storage denial responses could not be distinguished from an incomplete fixture.');
    }
    const afterForeignProbes = await filesA.list({ query: marker });
    const ownerFixtureAfterProbes = afterForeignProbes.find(item => item.id === fileId);
    if (!ownerFixtureAfterProbes) throw new Error('Foreign delete probe changed the owner fixture.');
    if (ownerFixtureAfterProbes.description !== 'Disposable staging Storage isolation acceptance fixture.') {
      throw new Error('Foreign update probe changed owner metadata.');
    }

    const nextFile = new File([nextText], `${marker}-v2.txt`, { type: 'text/plain' });
    const versioned = await filesA.addVersion(fileId, nextFile);
    if (versioned.versions?.[0]?.version_number !== 2 || versioned.user_id !== loginA.data.user.id) throw new Error('Owner version creation did not return the expected verified receipt.');
    storagePaths.add(versioned.versions[0].storage_path);
    const [oldBytes, newBytes] = await Promise.all([
      filesA.download(saved.versions[0]).then(blob => blob.text()),
      filesA.download(versioned.versions[0]).then(blob => blob.text()),
    ]);
    if (oldBytes !== initialText || newBytes !== nextText) throw new Error('Versioned file bytes did not match their saved metadata.');
    if ((await filesB.list({ query: marker })).some(item => item.id === fileId)) throw new Error('Cross-account file became visible after version creation.');

    result = { result: 'HOSTED_STAGING_STORAGE_ACCEPTANCE_PASS', environment: 'staging', project_ref: config.projectRef, owner_upload_download: true, version_bytes_and_metadata: true, foreign_read_update_delete_denied: true };
  } catch {
    failed = new Error('Hosted Storage staging acceptance failed; details were suppressed to protect test identities and provider responses.');
  } finally {
    if (fileId) {
      try {
        const ownerFiles = await filesA.list({ query: 'eylo-staging-storage-' });
        if (ownerFiles.some(item => item.id === fileId)) await filesA.remove(fileId);
        const remaining = await clientA.from('eylo_files').select('id').eq('id', fileId).eq('user_id', ownerId);
        if (remaining.error || remaining.data?.length) throw new Error('Owner file cleanup could not be verified.');
        // If a broken policy allowed the adversary probe to remove metadata,
        // clean only the synthetic paths created for this run through owner A.
        const paths = [...storagePaths];
        if (paths.length) {
          const { error } = await clientA.storage.from('eylo-files').remove(paths);
          if (error) throw new Error('Owner byte cleanup could not be verified.');
        }
        const left = await Promise.all(paths.map(path => clientA.storage.from('eylo-files').download(path)));
        if (left.some(item => !item.error && item.data)) throw new Error('Owner byte cleanup could not be verified.');
      } catch {
        failed = new Error(`Storage staging acceptance cleanup could not be confirmed. Inspect disposable fixture file ${fileId} in project ${config.projectRef}.`);
      }
    }
    await Promise.allSettled([clientA.auth.signOut(), clientB.auth.signOut()]);
  }
  if (failed) {
    console.error(failed.message);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ...result, cleanup: fileId ? 'confirmed' : 'not_needed', file_id: fileId }, null, 2));
  }
}
