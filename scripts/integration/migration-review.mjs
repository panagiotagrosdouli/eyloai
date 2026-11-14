import { createHash } from "node:crypto";

const SAFE_NAME = /^\d{8,14}_[a-z0-9_]+\.sql$/i;
const SIDE_EFFECTS =
  /\b(?:cron\.(?:schedule|unschedule)|net\.http_(?:post|get)|vault\.(?:create_secret|update_secret))\s*\(/i;
const EXTERNAL_TARGET = /https:\/\/[a-z]{20}\.supabase\.co\//i;

/** This verifies only a local replay manifest. It never emits/executes SQL,
 * connects to a database, renames legacy versions or approves remote changes. */
export function reviewMigrationPlan(plan, sources) {
  const issues = [],
    historyRisks = [];
  if (
    plan?.version !== 1 ||
    plan.scope !== "disposable-canonical-test-replay-only" ||
    plan.remote_application_authorized !== false
  )
    issues.push("Invalid or remotely-authorized manifest.");
  const rows = Array.isArray(plan?.files) ? plan.files : [];
  const selected = Array.isArray(plan?.canonical_local_order)
    ? plan.canonical_local_order
    : [];
  const registered = new Map();
  for (const row of rows) {
    if (!SAFE_NAME.test(row?.name || "") || registered.has(row.name)) {
      issues.push("Unsafe or duplicate manifest filename.");
      continue;
    }
    registered.set(row.name, row);
    const sql = sources[row.name];
    if (
      typeof sql !== "string" ||
      createHash("sha256").update(sql).digest("hex") !== row.sha256
    )
      issues.push(`Missing or changed migration: ${row.name}`);
    if (
      !["canonical-local-replay", "excluded-pending-review"].includes(
        row.classification,
      ) ||
      !row.reason
    )
      issues.push(`Unreviewed migration classification: ${row.name}`);
  }
  for (const name of Object.keys(sources))
    if (!registered.has(name))
      issues.push(`Unreviewed migration file: ${name}`);
  if (!selected.length || new Set(selected).size !== selected.length)
    issues.push("Empty or duplicate local replay order.");
  for (const name of selected) {
    if (
      !SAFE_NAME.test(name) ||
      registered.get(name)?.classification !== "canonical-local-replay"
    )
      issues.push(`Unapproved local replay entry: ${name}`);
    const sql = sources[name] || "";
    if (SIDE_EFFECTS.test(sql) || EXTERNAL_TARGET.test(sql))
      issues.push(
        `Scheduled/external side effects are not allowed in canonical local replay: ${name}`,
      );
  }
  for (const row of rows)
    if (
      row.classification === "canonical-local-replay" &&
      !selected.includes(row.name)
    )
      issues.push(`Canonical migration omitted from local order: ${row.name}`);
  const versions = new Map();
  for (const name of Object.keys(sources)) {
    const version = name.split("_")[0];
    if (!/^\d{14}$/.test(version))
      historyRisks.push(
        `Legacy timestamp requires history reconciliation: ${name}`,
      );
    if (!versions.has(version)) versions.set(version, []);
    versions.get(version).push(name);
  }
  for (const [version, names] of versions)
    if (names.length > 1)
      historyRisks.push(
        `Shared legacy version ${version}: ${names.join(", ")}`,
      );
  return {
    local_plan_verified: issues.length === 0,
    remote_application_authorized: false,
    remote_history_verified: false,
    selected_count: selected.length,
    excluded_count: rows.length - selected.length,
    issues,
    history_risks: historyRisks,
    excluded: rows
      .filter((row) => row.classification === "excluded-pending-review")
      .map(({ name, reason }) => ({ name, reason })),
    note: "A verified local replay is not a remote migration plan. Reconcile the existing hosted schema/history and review side effects in independently authorized staging. Never push all historical SQL blindly.",
  };
}
