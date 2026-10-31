import { searchAllPapersWithStatus } from '../src/lib/eyra-api.js';

const configuredBaseUrl = process.env.EYLO_LIVE_BASE_URL || 'https://eyloai.vercel.app';
const parsedBaseUrl = new URL(configuredBaseUrl);
if (!['https:', 'http:'].includes(parsedBaseUrl.protocol)) {
  throw new Error('EYLO_LIVE_BASE_URL must use HTTPS (HTTP is allowed for local development).');
}

const CASES = [
  {
    query: 'robotics for independent ageing',
    concept_groups: [
      ['robot', 'assistive technolog'],
      ['ageing', 'aging', 'older adult', 'elderly', 'independent living'],
    ],
    minimum_groups: 2,
  },
  {
    query: 'AI for early cancer detection',
    concept_groups: [
      ['artificial intelligence', 'machine learning', 'deep learning', 'neural network'],
      ['cancer', 'tumor', 'tumour', 'oncology'],
      ['early detection', 'screen', 'diagnos'],
    ],
    minimum_groups: 3,
  },
  {
    query: 'climate adaptation for coastal cities',
    concept_groups: [
      ['climate'],
      ['coast', 'sea level', 'flood'],
      ['adapt', 'resilien'],
    ],
    minimum_groups: 2,
  },
  {
    query: 'trustworthy AI in higher education',
    concept_groups: [
      ['trust', 'responsib', 'ethic', 'fair', 'explain'],
      ['artificial intelligence', 'machine learning', 'generative ai'],
      ['higher education', 'universit', 'student', 'academic'],
    ],
    minimum_groups: 2,
  },
  {
    query: 'uncertainty-aware trajectory prediction vulnerable road users',
    concept_groups: [
      ['uncertain', 'probabili', 'stochastic', 'confidence'],
      ['trajectory', 'motion prediction', 'path prediction'],
      ['pedestrian', 'cyclist', 'vulnerable road user'],
    ],
    minimum_groups: 2,
  },
];

const TOP_K = 10;
const MIN_CASE_ANCHOR_COVERAGE = 0.6;
const MIN_AVERAGE_ANCHOR_COVERAGE = 0.7;

function matchesCase(paper, testCase) {
  const text = `${paper.title || ''} ${paper.summary || ''}`.toLowerCase();
  const matchedGroups = testCase.concept_groups.filter(group =>
    group.some(anchor => text.includes(anchor))
  ).length;
  return matchedGroups >= testCase.minimum_groups;
}

const rows = [];
for (const testCase of CASES) {
  const result = await searchAllPapersWithStatus(testCase.query, {
    level: 'researcher',
    goal: 'review',
    recency: 'balanced',
    limit: TOP_K,
    proxyBaseUrl: parsedBaseUrl.origin,
  });
  const top = result.papers.slice(0, TOP_K);
  const anchorMatches = top.filter(paper => matchesCase(paper, testCase)).length;
  const anchorCoverage = top.length ? anchorMatches / top.length : 0;
  const representedSources = new Set(top.map(paper => paper.source_index).filter(Boolean));
  const sourceCoverageSufficient = top.length >= 5
    && result.available_source_count >= 3
    && representedSources.size >= 2;

  rows.push({
    query: testCase.query,
    records: top.length,
    heuristic_anchor_coverage_at_10: Number(anchorCoverage.toFixed(2)),
    anchor_matches: anchorMatches,
    represented_sources: representedSources.size,
    available_sources: result.available_source_count,
    unavailable_sources: result.unavailable_source_count,
    available_source_names: result.source_status.filter(source => source.status === 'available').map(source => source.label),
    unavailable_source_names: result.source_status.filter(source => source.status === 'unavailable').map(source => source.label),
    top_result: top[0]?.title || 'No live record',
    source_coverage_sufficient: sourceCoverageSufficient,
    coverage_warning: !sourceCoverageSufficient,
    anchor_gate_passed: sourceCoverageSufficient ? anchorCoverage >= MIN_CASE_ANCHOR_COVERAGE : null,
  });
}

console.table(rows);
const sourceCoveredRows = rows.filter(row => row.source_coverage_sufficient);
const averageAnchorCoverage = sourceCoveredRows.length
  ? sourceCoveredRows.reduce((sum, row) => sum + row.heuristic_anchor_coverage_at_10, 0) / sourceCoveredRows.length
  : 0;
const failedCases = sourceCoveredRows.filter(row => !row.anchor_gate_passed);
const coverageWarnings = rows.filter(row => row.coverage_warning);

console.log(`Source-covered cases: ${sourceCoveredRows.length}/${rows.length}`);
console.log(`Average heuristic anchor coverage@${TOP_K}: ${averageAnchorCoverage.toFixed(2)}`);
console.log(`Source-covered heuristic gates passed: ${sourceCoveredRows.length - failedCases.length}/${sourceCoveredRows.length}`);
console.log(`Source coverage warnings: ${coverageWarnings.length}/${rows.length}`);
console.log(`Proxy target: ${parsedBaseUrl.origin}`);
console.log('This automated anchor diagnostic is not a human-judged relevance benchmark.');

if (sourceCoveredRows.length < 2 || failedCases.length || averageAnchorCoverage < MIN_AVERAGE_ANCHOR_COVERAGE) {
  console.error('Live discovery anchor diagnostic failed. Review ranking or source coverage before release.');
  process.exitCode = 1;
}
