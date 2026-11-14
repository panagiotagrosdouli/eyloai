import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { reviewMigrationPlan } from "../scripts/integration/migration-review.mjs";
const root = new URL("../supabase/", import.meta.url);
const plan = JSON.parse(
  readFileSync(new URL("migration-review-plan.json", root), "utf8"),
);
const sources = Object.fromEntries(
  readdirSync(new URL("migrations/", root))
    .filter((n) => n.endsWith(".sql"))
    .map((n) => [n, readFileSync(new URL("migrations/" + n, root), "utf8")]),
);

test("actual migration manifest accounts for all28 files while authorizing only local21 replay", () => {
  const result = reviewMigrationPlan(plan, sources);
  assert.equal(result.local_plan_verified, true);
  assert.equal(result.selected_count, 21);
  assert.equal(result.excluded_count, 7);
  assert.equal(result.remote_application_authorized, false);
  assert.equal(result.remote_history_verified, false);
  assert.ok(
    result.excluded.some(
      (row) =>
        row.name.includes("scheduled_monitoring") &&
        /hardcoded live/.test(row.reason),
    ),
  );
});
test("legacy duplicate version IDs and nonstandard timestamps require reconciliation rather than silent renaming", () => {
  const result = reviewMigrationPlan(plan, sources);
  assert.ok(
    result.history_risks.some((issue) =>
      issue.includes("Shared legacy version 20260803"),
    ),
  );
  assert.ok(
    result.history_risks.some((issue) =>
      issue.includes("20261110_native_video_meetings.sql"),
    ),
  );
});
test("changed SQL and new unreviewed files fail manifest verification", () => {
  const name = plan.canonical_local_order[0];
  assert.equal(
    reviewMigrationPlan(plan, {
      ...sources,
      [name]: sources[name] + "\n-- changed",
    }).local_plan_verified,
    false,
  );
  assert.equal(
    reviewMigrationPlan(plan, {
      ...sources,
      "20261114100000_unreviewed.sql": "select 1;",
    }).local_plan_verified,
    false,
  );
});
test("even a newly pinned scheduler cannot be silently added to local canonical replay", () => {
  const name = "20261114100000_dangerous.sql",
    sql = "select cron.schedule('job','* * * * *','select 1');";
  const altered = structuredClone(plan);
  altered.canonical_local_order.push(name);
  altered.files.push({
    name,
    sha256: createHash("sha256").update(sql).digest("hex"),
    classification: "canonical-local-replay",
    reason: "New proposal",
  });
  assert.ok(
    reviewMigrationPlan(altered, { ...sources, [name]: sql }).issues.some(
      (issue) => /side effects/.test(issue),
    ),
  );
});
test("duplicate/traversal replay entries and remote approval flags fail closed", () => {
  const altered = structuredClone(plan);
  altered.canonical_local_order.push(
    altered.canonical_local_order[0],
    "../outside.sql",
  );
  assert.equal(
    reviewMigrationPlan(altered, sources).local_plan_verified,
    false,
  );
  altered.remote_application_authorized = true;
  assert.equal(
    reviewMigrationPlan(altered, sources).remote_application_authorized,
    false,
  );
  assert.equal(
    reviewMigrationPlan(altered, sources).local_plan_verified,
    false,
  );
});
