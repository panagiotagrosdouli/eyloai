// Pure, read-only comparison. Never generate SQL or authorize migration repair.
const VERSIONED_SQL = /^(\d{8,14})_[a-z0-9_]+\\.sql$/i;
const VERSION = /^\d{8,14}$/;

export function compareMigrationHistory(remoteEntries, localFiles) {
  if (!Array.isArray(remoteEntries) || !Array.isArray(localFiles)) {
    throw new TypeError('Migration inventories must be arrays.');
  }
  const remoteVersions = new Set();
  const localVersions = new Map();
  for (const item of remoteEntries) {
    const version = typeof item === 'string' ? item : item?.version;
    if (typeof version !== 'string' || !VERSION.test(version) || remoteVersions.has(version)) {
      throw new Error('Invalid or duplicate remote migration version.');
    }
    remoteVersions.add(version);
  }
  for (const filename of localFiles) {
    const match = typeof filename === 'string' && VERSIONED_SQL.exec(filename);
    if (!match) throw new Error('Invalid local migration filename.');
    const version = match[1];
    if (localVersions.has(version)) throw new Error('Duplicate local migration version.');
    localVersions.set(version, filename);
  }
  return {
    remote_count: remoteVersions.size,
    local_count: localFiles.length,
    matching_versions: [...remoteVersions].filter(version => localVersions.has(version)).sort(),
    remote_only_versions: [...remoteVersions].filter(version => !localVersions.has(version)).sort(),
    local_only_files: [...localVersions].filter(([version]) => !remoteVersions.has(version)).map(([, name]) => name).sort(),
    remote_history_verified: [...remoteVersions].every(version => localVersions.has(version)),
    remote_application_authorized: false,
    note: 'Read-only version comparison. Do not rename migrations, repair history, apply SQL or reset a branch from this output.',
  };
}
