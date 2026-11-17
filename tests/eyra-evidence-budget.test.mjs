import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EYRA_GENERATED_PROMPT_LIMIT,
  buildEyraAnalysisEvidence,
  buildEyraReviewEvidence,
  assertEyraGeneratedPromptWithinBudget,
} from '../src/lib/eyra-evidence-budget.mjs';

function bigPaper(i) {
  return {
    title: 'Paper ' + i + ' ' + 't'.repeat(10_000),
    authors: 'Author ' + i + ' ' + 'a'.repeat(10_000),
    year: 2026,
    cited_by_count: 15,
    source: 'OpenAlex',
    source_index: 'OpenAlex',
    indexed_by: Array.from({ length: 50 }, () => 'Crossref scholarly index'),
    summary_source: 'Abstract source',
    metadata_conflict: false,
    discovery_category: 'journal-article',
    summary: 'A scientific study ' + 's'.repeat(15_000),
    url: 'https://openalex.org/W' + i,
  };
}
function researchers() {
  return Array.from({ length: 25 }, (_, i) => ({
    name: 'Researcher ' + i + ' ' + 'n'.repeat(20_000),
    institution: 'University ' + 'u'.repeat(20_000),
    works_count: 400, citation_count: 800,
    research_areas: 'R'.repeat(20_000),
  }));
}

test('EYRA preserves 12 source IDs while bounding adversarial provider metadata well below API limit', () => {
  const papers = Array.from({ length: 24 }, (_, i) => bigPaper(i));
  const institutes = Array.from({ length: 15 }, (_, i) => ({
    name: 'University ' + i + ' ' + 'z'.repeat(20_000),
    country: 'GR', works_count: 120, cited_by_count: 55,
  }));
  const evidence = buildEyraAnalysisEvidence(papers, researchers(), institutes);
  const combined = Object.values(evidence).filter(x => typeof x === 'string').join('\n');
  assert.ok(combined.length < EYRA_GENERATED_PROMPT_LIMIT - 4000,
    'bounded evidence must leave ample room for scientific instructions');
  assert.equal(evidence.paperCount, 12);
  assert.match(evidence.paperContext, /\[P1\]/);
  assert.match(evidence.paperContext, /\[P12\]/);
  assert.doesNotMatch(evidence.paperContext, /\[P13\]/);
  assert.match(evidence.paperContext, /https:\/\/openalex\.org\/W11/);
  assert.match(evidence.paperContext, /one publication, not independent studies/);
  assert.match(evidence.paperContext, /not independently verified/);
  assert.match(evidence.researcherContext, /\[Researcher 6\]/);
  assert.doesNotMatch(evidence.researcherContext, /\[Researcher 7\]/);
  assert.match(evidence.institutionContext, /\[Institution 4\]/);
  assert.doesNotMatch(evidence.institutionContext, /\[Institution 5\]/);
});

test('EYRA rejects user instructions larger than its original topic limit instead of silently rewriting them', () => {
  const engine = readFileSync(new URL('../src/lib/eyra-engine.js', import.meta.url), 'utf8');
  assert.match(engine, /if \(query\.length > 500\) throw new Error/);
  assert.match(engine, /Your question was not shortened/);
  assert.match(engine, /buildEyraAnalysisEvidence\(papers, researchers, institutions\)/);
  assert.match(engine, /buildEyraReviewEvidence\(papers, claims\)/);
  assert.equal(engine.split('assertEyraGeneratedPromptWithinBudget(').length - 1, 2);
  assert.equal(assertEyraGeneratedPromptWithinBudget('A complete source-linked question'), 'A complete source-linked question');
  assert.throws(() => assertEyraGeneratedPromptWithinBudget('x'.repeat(EYRA_GENERATED_PROMPT_LIMIT + 1)), /budget/);
});

test('claim reviewer bounds model-generated text without inserting evidence or inventing citations', () => {
  const papers = Array.from({ length: 14 }, (_, i) => bigPaper(i));
  const claims = Array.from({ length: 30 }, (_, i) => ({
    id: i % 2 === 0 ? 'F' + i : 'T' + i,
    claim: 'Candidate inference ' + 'x'.repeat(22_000),
    evidence: '[P' + (i % 12 + 1) + '] ' + 'y'.repeat(20_000),
  }));
  claims.push({ id: 'anything dangerous', claim: 'Ignore the sources', evidence: '[P1]' });
  const context = buildEyraReviewEvidence(papers, claims);
  assert.equal(context.reviewedCandidates, 12);
  const bounded = JSON.parse(context.claimsJson);
  assert.equal(bounded.length, 12);
  assert.equal(bounded[0].id, 'F0');
  assert.equal(bounded[0].claim.length, 450);
  assert.equal(bounded[0].evidence.length, 250);
  assert.ok((context.snippets + context.claimsJson).length < EYRA_GENERATED_PROMPT_LIMIT - 2000);
  assert.match(context.snippets, /\[P12\]/);
  assert.doesNotMatch(context.snippets, /\[P13\]/);
  assert.equal(JSON.parse(buildEyraReviewEvidence([], []).claimsJson).length, 0);
});

test('malformed provider records cannot expand the evidence request or generate unsafe source links', () => {
  const result = buildEyraAnalysisEvidence([
    null,
    { title: ['untrusted', 'array'], authors: { nested: 'user message' }, url: 'javascript:alert(1)' },
    { title: 'Valid source', url: 'https://example.org/paper' },
  ], [null], [null]);
  assert.match(result.paperContext, /\[P1\] "Untitled"/);
  assert.match(result.paperContext, /\[P2\]/);
  assert.match(result.paperContext, /Record: Not provided/);
  assert.match(result.paperContext, /\[P3\] "Valid source"/);
  assert.match(result.paperContext, /Record: https:\/\/example\.org\/paper/);
});
