import test from "node:test";
import assert from "node:assert/strict";
import { buildRecordedProjectSignals } from "../src/lib/project-recorded-signals.mjs";
import { blankBudget, blankBudgetLine } from "../src/lib/project-budget.mjs";

test("saved workplan progress distinguishes recorded completion, overdue dates and blocked tasks", () => {
  const project = {
    id: "p1",
    updated_date: "2026-11-14T10:00:00Z",
    plan_items: [
      {
        id: "a",
        title: "Recorded done",
        status: "done",
        due_date: "2026-11-01",
      },
      { id: "b", title: "Blocked", status: "blocked", due_date: "2026-11-13" },
      { id: "c", title: "Due today", status: "todo", due_date: "2026-11-14" },
    ],
  };
  const before = JSON.stringify(project);
  const result = buildRecordedProjectSignals(project, "2026-11-14");
  assert.equal(result.model_generated, false);
  assert.equal(result.project_version, project.updated_date);
  const plan = result.signals[0];
  assert.equal(plan.percent, 33);
  assert.equal(plan.overdue, 1);
  assert.equal(plan.blocked, 1);
  assert.equal(plan.source_field, "plan_items");
  assert.equal(
    JSON.stringify(project),
    before,
    "summary never mutates saved records",
  );
});

test("missing data is not a fabricated zero-percent project or a funded budget", () => {
  const result = buildRecordedProjectSignals({ id: "p1" }, "2026-11-14");
  assert.equal(result.signals[0].percent, null);
  assert.equal(result.signals[0].value, "No saved workplan");
  assert.equal(
    result.signals.find((s) => s.key === "budget").value,
    "No saved budget",
  );
});

test("invalid workspaces are reported independently without discarding other saved signals", () => {
  const result = buildRecordedProjectSignals(
    {
      id: "p1",
      plan_items: [{ id: "a", title: "Invalid status", status: "imaginary" }],
      experiment_records: [{ id: "invalid" }],
      research_budget: { currency: "INVALID" },
    },
    "2026-11-14",
  );
  assert.deepEqual(
    result.signals.filter((s) => !s.available).map((s) => s.key),
    ["workplan", "experiments", "budget"],
  );
  assert.equal(
    result.signals.find((s) => s.key === "publications").available,
    true,
  );
});

test("recorded budget totals use canonical integer cents and show over-allocation without inventing funds", () => {
  const budget = blankBudget();
  budget.allocation = "0.20";
  budget.lines = [
    { ...blankBudgetLine(), title: "Expense", planned: "0.30", actual: "0.30" },
  ];
  const signal = buildRecordedProjectSignals(
    { id: "p1", research_budget: budget },
    "2026-11-14",
  ).signals.find((s) => s.key === "budget");
  assert.equal(signal.actual_minor, 30);
  assert.equal(signal.remaining_minor, -10);
  assert.equal(signal.overallocated, true);
  assert.match(signal.value, /EUR 0.30/);
});

test("invalid dates and unsaved project identity fail instead of generating a summary", () => {
  assert.throws(
    () => buildRecordedProjectSignals({ id: "p1" }, "2026-02-30"),
    /valid local date/,
  );
  assert.throws(
    () => buildRecordedProjectSignals({}, "2026-11-14"),
    /saved project/,
  );
});
