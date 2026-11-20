// Pure, read-only comparison. Never generate SQL or authorize migration repair.
const VERSIONED_SQL = /^(\d{8,14})_[a-z0-9_]+\.sql$/i;
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
    const files = localVersions.get(version) || [];
    files.push(filename);
    localVersions.set(version, files);
  }
  const ambiguousLocalVersions = [...localVersions]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files: [...files].sort() }))
    .sort((a, b) => a.version.localeCompare(b.version));
  const exactMatches = [...remoteVersions]
    .filter(version => localVersions.get(version)?.length === 1)
    .sort();
  return {
    remote_count: remoteVersions.size,
    local_count: localFiles.length,
    matching_versions: exactMatches,
    ambiguous_local_versions: ambiguousLocalVersions,
    remote_only_versions: [...remoteVersions].filter(version => !localVersions.has(version)).sort(),
    local_only_files: [...localVersions].filter(([version]) => !remoteVersions.has(version)).flatMap(([, files]) => files).sort(),
    remote_history_verified: ambiguousLocalVersions.length === 0 && [...remoteVersions].every(version => localVersions.get(version)?.length === 1),
    remote_application_authorized: false,
    note: 'Read-only version comparison. Do not rename migrations, repair history, apply SQL or reset a branch from this output.',
  };
}
