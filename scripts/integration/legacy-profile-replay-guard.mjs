/** Fail-closed historical SQL replay classification; never modifies a database. */
export function assessLegacyProfileReplay({ legacyBootstrap, hardeningSql, bridgeSql, fingerprints }) {
  if (![legacyBootstrap, hardeningSql, bridgeSql].every(x => typeof x === 'string')
    || !Array.isArray(fingerprints?.items)) throw new TypeError('Missing historical SQL evidence.');
  const item = fingerprints.items.find(x => x.remote_name === 'security_hardening');
  if (!item || item.classification !== 'divergent_sql_requires_review'
    || !/^\\d{14}$/.test(item.remote_version)) {
    throw new Error('Historical security migration has not been independently classified.');
  }
  const profileDefinition = legacyBootstrap.match(/create table public\\.profiles\\s*\\(([\\s\\S]*?)\\);/i)?.[1];
  if (!profileDefinition) throw new Error('Legacy profiles schema is not available.');
  const legacyId = /(?:^|,)\\s*id\\s+uuid\\b/i.test(profileDefinition);
  const legacyOwnerColumn = /(?:^|,)\\s*user_id\\s+uuid\\b/i.test(profileDefinition);
  const hardeningUsesLaterColumn =
    /create policy profiles_(?:select|insert|update)[\\s\\S]*?auth\\.uid\\(\\)\\) = user_id/i.test(hardeningSql);
  const bridgeAddsColumn = /alter table public\\.profiles add column if not exists user_id uuid/i.test(bridgeSql);
  const bridgeEnforcesMatch = /profiles_bridge_owner_matches[\\s\\S]*?check\\(id=user_id\\)/i.test(bridgeSql);
  const risks = [];
  if (!legacyId) risks.push('legacy_profile_identity_unknown');
  if (legacyOwnerColumn) risks.push('legacy_profile_shape_changed');
  if (!hardeningUsesLaterColumn) risks.push('local_security_sql_changed');
  if (!bridgeAddsColumn || !bridgeEnforcesMatch) risks.push('owner_bridge_invariant_unverified');
  if (!legacyOwnerColumn && hardeningUsesLaterColumn && bridgeAddsColumn)
    risks.push('local_security_sql_references_column_missing_in_legacy_schema');
  if (item.remote_version >= '20261115191303')
    risks.push('remote_security_order_inconsistent');
  return {
    remote_application_authorized: false,
    historical_replay_safe: false,
    review_required: true,
    legacy_profile_has_user_id: legacyOwnerColumn,
    risks,
    note: 'Do not replay security_hardening before the reviewed owner column exists. Use the original applied SQL and an independently approved staging reconstruction.',
  };
}
