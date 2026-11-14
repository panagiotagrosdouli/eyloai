import { getWorkplanProgress, validateWorkplan } from "./project-workplan.mjs";
import { readResearchRecords } from "./research-records.mjs";
import { readBudget, budgetTotals, minorToMoney } from "./project-budget.mjs";

function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** Derive facts from a saved canonical project, not an unsaved editor or model. */
export function buildRecordedProjectSignals(project, asOfDate) {
  if (!project?.id || !validDate(asOfDate))
    throw new Error("A saved project and valid local date are required.");
  const signals = [];
  function signal(key, label, build) {
    try {
      signals.push({ key, label, available: true, ...build() });
    } catch {
      signals.push({
        key,
        label,
        available: false,
        value: "Needs review",
        detail:
          "Saved records could not be read in their supported format. Open the source workspace to review them.",
      });
    }
  }
  signal("workplan", "Saved workplan", () => {
    const raw = project.plan_items ?? [];
    const result = validateWorkplan(raw);
    if (
      !result.valid ||
      raw.some(
        (item) =>
          !["todo", "in_progress", "blocked", "done"].includes(item?.status),
      )
    )
      throw new Error("Invalid saved workplan");
    const progress = getWorkplanProgress(result.items);
    const overdue = result.items.filter(
      (item) =>
        item.status !== "done" && item.due_date && item.due_date < asOfDate,
    ).length;
    const blocked = result.items.filter(
      (item) => item.status === "blocked",
    ).length;
    return {
      value: progress.total
        ? `${progress.done} / ${progress.total} recorded tasks done`
        : "No saved workplan",
      detail: progress.total
        ? `${overdue} overdue target dates · ${blocked} marked blocked. Completion is self-reported, not verified delivery.`
        : "Save workplan tasks to calculate recorded completion.",
      source_field: "plan_items",
      done: progress.done,
      total: progress.total,
      percent: progress.total ? progress.percent : null,
      overdue,
      blocked,
    };
  });
  signal("experiments", "Experiment records", () => {
    const rows = readResearchRecords("experiments", project);
    const completed = rows.filter((row) => row.status === "completed").length;
    return {
      value: `${rows.length} saved experiments`,
      detail: `${completed} marked completed with a recorded result. This does not verify that an experiment succeeded or was reproduced.`,
      source_field: "experiment_records",
      completed,
      total: rows.length,
    };
  });
  signal("publications", "Publication records", () => {
    const rows = readResearchRecords("publications", project);
    const published = rows.filter((row) => row.status === "published").length;
    return {
      value: `${rows.length} tracked manuscripts`,
      detail: `${published} marked published by you. Publisher acceptance and publication status are not independently verified.`,
      source_field: "publication_records",
      published,
      total: rows.length,
    };
  });
  signal("budget", "Saved research budget", () => {
    if (!project.research_budget)
      return {
        value: "No saved budget",
        detail:
          "Open Research Budget to record a currency, allocation and expense lines.",
        source_field: "research_budget",
      };
    const budget = readBudget(project),
      totals = budgetTotals(budget);
    return {
      value: `${budget.currency} ${minorToMoney(totals.actual)} recorded actual`,
      detail: `${budget.currency} ${minorToMoney(totals.remaining)} of the recorded allocation remains. Amounts are user-entered, not bank or accounting verification.`,
      source_field: "research_budget",
      currency: budget.currency,
      actual_minor: totals.actual,
      remaining_minor: totals.remaining,
      overallocated: totals.remaining < 0,
    };
  });
  return {
    project_id: String(project.id),
    project_version: project.updated_date || null,
    as_of_date: asOfDate,
    signals,
    model_generated: false,
  };
}
