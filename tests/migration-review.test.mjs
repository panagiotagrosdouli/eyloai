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

test("actual migration manifest accounts for every pinned file while authorizing only local replay", () => {
  const result = reviewMigrationPlan(plan, sources);
  assert.equal(result.local_plan_verified, true);
  assert.equal(result.selected_count, plan.canonical_local_order.length);
  assert.equal(result.excluded_count, plan.files.length - plan.canonical_local_order.length);
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
test("lesson progress policy migration qualifies the progress course ID in its write check", () => {
  const source = readFileSync(
    new URL("../supabase/migrations/20261128122000_learning_lesson_progress_policy_qualification.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /l\.course_id\s*=\s*learning_lesson_progress\.course_id/);
  assert.doesNotMatch(source, /l\.course_id\s*=\s*l\.course_id/);
  assert.match(source, /drop policy if exists "Users manage own lesson progress"/i);
});
test("foreign-key index migration covers every observed advisor finding", () => {
  const source = readFileSync(
    new URL("../supabase/migrations/20261128134000_index_uncovered_foreign_keys.sql", import.meta.url),
    "utf8",
  );
  const expected = [
    ["eylo_file_versions_parent_owner_fk_idx", "eylo_file_versions", "file_id, user_id"],
    ["eylo_files_project_fk_idx", "eylo_files", "project_id"],
    ["learning_courses_source_note_fk_idx", "learning_courses", "source_note_id"],
    ["learning_progress_assessment_fk_idx", "learning_lesson_progress", "assessment_attempt_id"],
    ["learning_progress_lesson_course_user_fk_idx", "learning_lesson_progress", "lesson_id, course_id, user_id"],
    ["learning_lessons_course_user_fk_idx", "learning_lessons", "course_id, user_id"],
    ["learning_lessons_quiz_fk_idx", "learning_lessons", "quiz_id"],
    ["quiz_attempts_learning_lesson_fk_idx", "quiz_attempts", "learning_lesson_id"],
    ["quiz_attempts_quiz_user_fk_idx", "quiz_attempts", "quiz_id, user_id"],
    ["quiz_questions_quiz_user_fk_idx", "quiz_questions", "quiz_id, user_id"],
    ["quizzes_source_note_fk_idx", "quizzes", "source_note_id"],
    ["time_entries_life_task_fk_idx", "time_entries", "life_task_id"],
    ["time_entries_project_fk_idx", "time_entries", "project_id"],
  ];
  assert.equal(source.match(/create index if not exists/gi)?.length, expected.length);
  for (const [index, table, columns] of expected) {
    assert.match(source, new RegExp(`create index if not exists ${index}\\s+on public\\.${table} \\(${columns}\\)`, "i"));
  }
  assert.doesNotMatch(source, /drop index/i);
});
test("personal API token audit migration stores no credential material and is owner-read-only", () => {
  const source = readFileSync(
    new URL("../supabase/migrations/20261128141000_eylo_api_token_events.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /create table public\.eylo_api_token_events/i);
  assert.match(source, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(source, /action in \('created', 'revoked'\)/i);
  assert.doesNotMatch(source, /\b(token_hash|raw_token|secret_key)\b/i);
  assert.match(source, /enable row level security/i);
  assert.match(source, /for select to authenticated using \(user_id = auth\.uid\(\)\)/i);
  assert.match(source, /revoke all on public\.eylo_api_token_events from public, anon, authenticated, service_role/i);
  assert.match(source, /grant select on public\.eylo_api_token_events to authenticated, service_role/i);
  assert.match(source, /after insert on public\.eylo_api_tokens/i);
  assert.match(source, /after update of revoked_at on public\.eylo_api_tokens/i);
});
test("provider coordination migration shares atomic leases and cache while hiding research queries", () => {
  const source = readFileSync(
    new URL("../supabase/migrations/20261128145000_scholarly_provider_coordination.sql", import.meta.url),
    "utf8",
  );
  for (const table of ['scholarly_provider_state', 'scholarly_provider_leases', 'scholarly_response_cache']) {
    assert.match(source, new RegExp(`create table public\\.${table}`, 'i'));
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  for (const rpc of ['reserve_scholarly_provider_slot', 'finish_scholarly_provider_request', 'read_scholarly_provider_cache', 'write_scholarly_provider_cache']) {
    assert.match(source, new RegExp(`create function public\\.${rpc}`, 'i'));
    assert.match(source, new RegExp(`public\\.${rpc}\\([\\s\\S]*?to service_role`, 'i'));
  }
  assert.match(source, /expires_at timestamptz not null/);
  assert.match(source, /cooldown_until timestamptz not null/);
  assert.match(source, /consecutive_failures integer not null/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /if cache_rows > 10000 then/);
  assert.doesNotMatch(source, /query text|research_query/i);
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
