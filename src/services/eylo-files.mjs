import { EYLO_FILE_BUCKET, safeStorageFilename, validateEyloFile } from '../lib/eylo-files.mjs';

const FILE_LIMIT = 500;

function raise(error) {
  if (error) throw error;
}

function fileClient(client) {
  if (!client) throw new Error('File storage is not configured.');
  return client;
}

async function requireUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) throw Object.assign(new Error('Sign in again to access private files.'), { code: 'AUTHENTICATION_REQUIRED', status: 401 });
  return data.user;
}

function makeId() {
  if (!globalThis.crypto?.randomUUID) throw new Error('This browser cannot create secure file identifiers. Update your browser and try again.');
  return globalThis.crypto.randomUUID();
}

export function createEyloFilesService(client) {
  return {
    async list({ query = '', projectId = '' } = {}) {
      const supabase = fileClient(client);
      const user = await requireUser(supabase);
      let request = supabase.from('eylo_files').select('*').eq('user_id', user.id)
        .order('updated_at', { ascending: false }).limit(FILE_LIMIT);
      if (projectId) request = request.eq('project_id', projectId);
      const { data: records, error } = await request;
      raise(error);
      const files = records || [];
      if (!files.length) return [];
      const { data: versions, error: versionsError } = await supabase.from('eylo_file_versions').select('*')
        .in('file_id', files.map(item => item.id)).order('version_number', { ascending: false });
      raise(versionsError);
      const byFile = new Map();
      for (const version of versions || []) {
        if (!byFile.has(version.file_id)) byFile.set(version.file_id, []);
        byFile.get(version.file_id).push(version);
      }
      const filtered = files.map(file => {
        const fileVersions = byFile.get(file.id) || [];
        return { ...file, latest_version_id: fileVersions[0]?.id || null, versions: fileVersions };
      });
      const normalized = String(query || '').trim().toLocaleLowerCase();
      return normalized ? filtered.filter(file => [file.name, file.description].some(value => String(value || '').toLocaleLowerCase().includes(normalized))) : filtered;
    },

    async upload(file, { projectId = null, description = '' } = {}) {
      const supabase = fileClient(client);
      const user = await requireUser(supabase);
      const details = validateEyloFile(file);
      const id = makeId();
      const versionId = makeId();
      const storagePath = `${user.id}/${id}/${versionId}_${safeStorageFilename(details.name)}`;
      let uploaded = false;
      let recordCreated = false;
      try {
        const { data: record, error: recordError } = await supabase.from('eylo_files').insert({
          id, user_id: user.id, project_id: projectId || null, name: details.name,
          mime_type: details.mimeType, size_bytes: details.sizeBytes,
          description: String(description).trim().slice(0, 2000),
        }).select('*').single();
        raise(recordError);
        recordCreated = true;
        const { error: uploadError } = await supabase.storage.from(EYLO_FILE_BUCKET)
          .upload(storagePath, file, { contentType: details.mimeType, upsert: false });
        raise(uploadError);
        uploaded = true;
        const { data: version, error: versionError } = await supabase.from('eylo_file_versions').insert({
          id: versionId, file_id: id, user_id: user.id, storage_path: storagePath,
          version_number: 1, mime_type: details.mimeType, size_bytes: details.sizeBytes,
        }).select('*').single();
        raise(versionError);
        const { error: updateError } = await supabase.from('eylo_files').update({ updated_at: new Date().toISOString() })
          .eq('id', id).eq('user_id', user.id).select('id').single();
        raise(updateError);
        return { ...record, latest_version_id: version.id, versions: [version] };
      } catch (error) {
        if (uploaded) await supabase.storage.from(EYLO_FILE_BUCKET).remove([storagePath]).catch(() => {});
        if (recordCreated) await supabase.from('eylo_files').delete().eq('id', id).eq('user_id', user.id);
        throw error;
      }
    },

    async addVersion(fileId, file) {
      const supabase = fileClient(client);
      const user = await requireUser(supabase);
      const details = validateEyloFile(file);
      const { data: current, error: currentError } = await supabase.from('eylo_files').select('*')
        .eq('id', fileId).eq('user_id', user.id).single();
      raise(currentError);
      const { data: latest, error: latestError } = await supabase.from('eylo_file_versions').select('version_number')
        .eq('file_id', fileId).order('version_number', { ascending: false }).limit(1).maybeSingle();
      raise(latestError);
      const versionId = makeId();
      const storagePath = `${user.id}/${fileId}/${versionId}_${safeStorageFilename(details.name)}`;
      let uploaded = false;
      let versionCreated = false;
      try {
        const { error: uploadError } = await supabase.storage.from(EYLO_FILE_BUCKET)
          .upload(storagePath, file, { contentType: details.mimeType, upsert: false });
        raise(uploadError);
        uploaded = true;
        const { data: version, error: versionError } = await supabase.from('eylo_file_versions').insert({
          id: versionId, file_id: fileId, user_id: user.id, storage_path: storagePath,
          version_number: Number(latest?.version_number || 0) + 1,
          mime_type: details.mimeType, size_bytes: details.sizeBytes,
        }).select('*').single();
        raise(versionError);
        versionCreated = true;
        const { error: updateError } = await supabase.from('eylo_files').update({
          mime_type: details.mimeType, size_bytes: details.sizeBytes,
          updated_at: new Date().toISOString(),
          name: details.name,
        }).eq('id', fileId).eq('user_id', user.id).select('id').single();
        raise(updateError);
        return { ...current, latest_version_id: version.id, name: details.name,
          mime_type: details.mimeType, size_bytes: details.sizeBytes, versions: [version] };
      } catch (error) {
        if (versionCreated) await supabase.from('eylo_file_versions').delete().eq('id', versionId).eq('user_id', user.id);
        if (uploaded) await supabase.storage.from(EYLO_FILE_BUCKET).remove([storagePath]).catch(() => {});
        throw error;
      }
    },

    async update(fileId, patch) {
      const supabase = fileClient(client);
      const user = await requireUser(supabase);
      const allowed = {};
      if (patch.description !== undefined) allowed.description = String(patch.description).trim().slice(0, 2000);
      if (patch.project_id !== undefined) allowed.project_id = patch.project_id || null;
      if (!Object.keys(allowed).length) return null;
      const { data, error } = await supabase.from('eylo_files').update(allowed)
        .eq('id', fileId).eq('user_id', user.id).select('*').single();
      raise(error);
      return data;
    },

    async download(version) {
      const supabase = fileClient(client);
      await requireUser(supabase);
      if (!version?.id || !version?.file_id) throw new Error('Choose a saved file version.');
      const { data: record, error: recordError } = await supabase.from('eylo_file_versions').select('id, storage_path')
        .eq('id', version.id).eq('file_id', version.file_id).single();
      raise(recordError);
      if (!record) throw new Error('File version was not found or access was denied.');
      const { data, error } = await supabase.storage.from(EYLO_FILE_BUCKET).download(record.storage_path);
      raise(error);
      return data;
    },

    async remove(fileId) {
      const supabase = fileClient(client);
      const user = await requireUser(supabase);
      const { data: versions, error: versionsError } = await supabase.from('eylo_file_versions').select('storage_path')
        .eq('file_id', fileId);
      raise(versionsError);
      const paths = (versions || []).map(item => item.storage_path);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from(EYLO_FILE_BUCKET).remove(paths);
        raise(storageError);
      }
      const { data, error } = await supabase.from('eylo_files').delete().eq('id', fileId)
        .eq('user_id', user.id).select('id');
      raise(error);
      if (!data?.length) throw new Error('File was not found or access was denied.');
    },
  };
}
