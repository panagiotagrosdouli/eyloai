import test from "node:test";
import assert from "node:assert/strict";
import { ANALYSABLE_WORKBENCH_TOOLS, canAnalyseWorkbenchTool, buildWorkbenchAnalysisPrompt } from "../src/lib/workbench-analysis.mjs";

test("six workbench products support explicit actionable analyses", () => {
  assert.equal(ANALYSABLE_WORKBENCH_TOOLS.length, 6);
  for (const tool of ANALYSABLE_WORKBENCH_TOOLS) assert.equal(canAnalyseWorkbenchTool(tool), true);
  assert.equal(canAnalyseWorkbenchTool("__proto__"), false);
  assert.throws(() => buildWorkbenchAnalysisPrompt("forms", {title:"Survey"}), /no EYRA analysis/);
});

test("methodology analysis asks for protocol outputs without fabricating sources", () => {
  const prompt = buildWorkbenchAnalysisPrompt("methodology", {
    title: "Design", objective: "causal", question: "Does X affect Y?",
    approach: "Observational cohorts", limitations: "Unmeasured factors",
    private_unused_field: "MUST NEVER LEAK",
  });
  assert.match(prompt, /protocol outline/);
  assert.match(prompt, /confounding/);
  assert.match(prompt, /causal effect/);
  assert.match(prompt, /Missing evidence \/ verification/);
  assert.doesNotMatch(prompt, /MUST NEVER LEAK/);
});

test("ethics and conference analyses do not assert external approval or verification", () => {
  const ethics = buildWorkbenchAnalysisPrompt("ethics", {
    title: "Human subjects", participants: "yes", sensitive: "yes",
    consent: "planned", approval: "approved", reference: "https://example.com",
    retention: "Delete records after a defined period",
  });
  assert.match(ethics, /declared approval status from verified approval/);
  const conference = buildWorkbenchAnalysisPrompt("conferences", {
    title: "Event", website: "https://example.com", date: "2027-05-01",
    deadline: "2027-01-01", location: "Online", fee: "20.00",
  });
  assert.match(conference, /unverified user-supplied/);
  assert.throws(() => buildWorkbenchAnalysisPrompt("skills", { title: "A", baseline: "1", current: 2, target: "5", practice: "" }), /unsupported field/);
});
