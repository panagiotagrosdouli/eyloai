import { researchCatalogStorageKey } from "../research-catalog.mjs";
const OWNER = "eylo:legacy-private-cache-owner:v1";
const LEGACY_PREFIXES = [
  "eyra_future_me_",
  "eyra_twin_v2_",
  "eyra_daily_missions_",
  "eyra_mission_completed_",
  "eyra_pitch_deck_latest_",
];
export function clearLegacyPrivateCaches(storage) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (LEGACY_PREFIXES.some((prefix) => key?.startsWith(prefix)))
      storage.removeItem(key);
  }
  storage.removeItem(OWNER);
}
// Old private derived caches lacked ownership. Never silently attribute them
// to the next signed-in user; same-owner refreshes retain current caches.
export function bindLegacyPrivateCacheOwner(storage, userId) {
  if (!userId) {
    clearLegacyPrivateCaches(storage);
    return;
  }
  if (storage.getItem(OWNER) !== userId) clearLegacyPrivateCaches(storage);
  storage.setItem(OWNER, userId);
}
export function clearDeletedOwnerBrowserData(local, session, userId) {
  const catalogKey = researchCatalogStorageKey(userId);
  if (!catalogKey) throw new Error("Expected deleted account identity.");
  local.removeItem(catalogKey);
  local.removeItem("eylo:offline:v1:" + userId);
  const conversationKey = `eyra:conversation:v3:${encodeURIComponent(userId)}`;
  const prefixes = [
    `eylo:notes:draft:${userId}:`,
    `eylo:document-draft:${userId}:`,
    `eylo:product-operation:${userId}:`,
    `${conversationKey}:`,
  ];
  for (let index = session.length - 1; index >= 0; index--) {
    const key = session.key(index);
    if (
      key === conversationKey ||
      prefixes.some((prefix) => key?.startsWith(prefix))
    )
      session.removeItem(key);
  }
  if (local.getItem(OWNER) === userId) clearLegacyPrivateCaches(local);
}
