import test from "node:test";
import assert from "node:assert/strict";
import {
  clearDeletedOwnerBrowserData,
  bindLegacyPrivateCacheOwner,
  clearLegacyPrivateCaches,
} from "../src/lib/auth/privateBrowserData.mjs";
function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("private legacy caches cannot migrate to another identity or retain an unknown owner", () => {
  const local = storage({
    eyra_future_me_goal: "prior goal",
    eyra_pitch_deck_latest_v2: "prior deck",
    eylo_prefs: "device theme",
  });
  bindLegacyPrivateCacheOwner(local, "owner-a");
  assert.equal(local.getItem("eyra_future_me_goal"), null);
  local.setItem("eyra_future_me_goal", "new goal");
  bindLegacyPrivateCacheOwner(local, "owner-a");
  assert.equal(local.getItem("eyra_future_me_goal"), "new goal");
  bindLegacyPrivateCacheOwner(local, "owner-b");
  assert.equal(local.getItem("eyra_future_me_goal"), null);
  assert.equal(local.getItem("eylo_prefs"), "device theme");
});
test("confirmed deletion clears owned local catalog/drafts without erasing another owner or device preferences", () => {
  const local = storage({
    "eylo.research-data-catalog.v1:a": "A",
    "eylo.research-data-catalog.v1:b": "B",
    "eylo:offline:v1:a": "ciphertext",
    "eylo:legacy-private-cache-owner:v1": "a",
    eyra_future_me_goal: "A goal",
    eylo_prefs: "theme",
  });
  const session = storage({
    "eylo:notes:draft:a:new": "A",
    "eylo:notes:draft:ab:new": "AB",
    "eylo:document-draft:a:new": "A doc",
    "eyra:conversation:v3:a:snapshot-request": "A retry",
    "eyra:conversation:v3:ab": "AB conversation",
    "eylo:notes:draft:b:new": "B",
  });
  clearDeletedOwnerBrowserData(local, session, "a");
  assert.equal(local.getItem("eylo.research-data-catalog.v1:a"), null);
  assert.equal(local.getItem("eylo.research-data-catalog.v1:b"), "B");
  assert.equal(local.getItem("eylo_prefs"), "theme");
  assert.equal(local.getItem("eyra_future_me_goal"), null);
  assert.equal(session.getItem("eylo:notes:draft:a:new"), null);
  assert.equal(session.getItem("eylo:notes:draft:ab:new"), "AB");
  assert.equal(session.getItem("eylo:notes:draft:b:new"), "B");
  assert.equal(session.getItem("eylo:document-draft:a:new"), null);
  assert.equal(session.getItem("eyra:conversation:v3:ab"), "AB conversation");
});
test("deletion cannot clear a foreign legacy-cache owner and requires a concrete identity", () => {
  const local = storage({
    "eylo:legacy-private-cache-owner:v1": "b",
    eyra_future_me_goal: "B goal",
  });
  clearDeletedOwnerBrowserData(local, storage(), "a");
  assert.equal(local.getItem("eyra_future_me_goal"), "B goal");
  assert.throws(
    () => clearDeletedOwnerBrowserData(local, storage(), ""),
    /identity/,
  );
  clearLegacyPrivateCaches(local);
  assert.equal(local.getItem("eyra_future_me_goal"), null);
});
