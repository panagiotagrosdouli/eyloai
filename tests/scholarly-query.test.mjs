import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScholarlyQuery,
  scholarlyQueryTerms,
} from "../src/lib/scholarly-query.mjs";
import { readFile } from "node:fs/promises";
test("native arXiv fields bind every concept rather than only the leading word", () => {
  const query = buildScholarlyQuery("arxiv", "robotics for independent ageing");
  assert.equal(
    query,
    '(all:robot*) AND (all:independen*) AND (all:ageing OR all:aging OR all:"older adults" OR all:elderly)',
  );
  assert.ok(
    buildScholarlyQuery(
      "arxiv",
      "uncertainty-aware trajectory prediction vulnerable road users",
    ).includes("all:uncertain*"),
  );
  assert.ok(
    buildScholarlyQuery("arxiv", "AI cancer").includes(
      'all:"artificial intelligence"',
    ),
  );
});
test("provider queries retain all content concepts, escape operator punctuation and keep original queries for other providers", () => {
  assert.deepEqual(scholarlyQueryTerms("AI for early cancer detection"), [
    "ai",
    "early",
    "cancer",
    "detection",
  ]);
  assert.equal(
    buildScholarlyQuery("crossref", "AI for early cancer detection"),
    "ai early cancer detection",
  );
  assert.ok(
    buildScholarlyQuery("europe_pmc", "AI for early cancer detection").includes(
      '("early") AND ("cancer")',
    ),
  );
  assert.equal(
    buildScholarlyQuery("openalex", "Original query"),
    "Original query",
  );
  assert.equal(
    buildScholarlyQuery("arxiv", 'study ) OR ( "unsafe"'),
    '(all:"study") AND (all:"or") AND (all:"unsafe")',
  );
  assert.ok(
    buildScholarlyQuery("arxiv", "Ελληνική έρευνα").includes('"ελληνική"'),
  );
});
test("live diagnostic requires all five source-covered cases and retains the independent anchor gates", async () => {
  const source = await readFile(
    new URL("../scripts/benchmark-live-retrieval.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /sourceCoveredRows.length !== CASES.length/);
  assert.match(source, /MIN_CASE_ANCHOR_COVERAGE = 0.6/);
  assert.match(source, /MIN_AVERAGE_ANCHOR_COVERAGE = 0.7/);
  assert.match(source, /top.length >= 5/);
  assert.match(source, /representedSources.size >= 2/);
});
