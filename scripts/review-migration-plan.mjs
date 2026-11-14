import { readFile, readdir } from "node:fs/promises";
import { reviewMigrationPlan } from "./integration/migration-review.mjs";

try {
  const root = new URL("../supabase/", import.meta.url);
  const plan = JSON.parse(
    await readFile(new URL("migration-review-plan.json", root), "utf8"),
  );
  const names = (await readdir(new URL("migrations/", root))).filter((name) =>
    name.endsWith(".sql"),
  );
  const sources = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        await readFile(new URL("migrations/" + name, root), "utf8"),
      ]),
    ),
  );
  const result = reviewMigrationPlan(plan, sources);
  console.log(JSON.stringify(result, null, 2));
  if (!result.local_plan_verified) process.exitCode = 1;
} catch {
  console.error(
    "Migration manifest review failed. No database operation was attempted.",
  );
  process.exitCode = 1;
}
