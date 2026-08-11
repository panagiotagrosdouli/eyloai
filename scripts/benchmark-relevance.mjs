import { searchAllPapersWithStatus } from '../src/lib/eyra-api.js';

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
    minimum_groups: 2,
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
const MIN_CASE_PRECISION = 0.6;
const MIN_AVERAGE_PRECISION = 0.7;

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
  });
  const top = result.papers.slice(0, TOP_K);
  const relevant = top.filter(paper => matchesCase(paper, testCase)).length;
  const precision = top.length ? relevant / top.length : 0;
  const representedSources = new Set(top.map(paper => paper.source_index).filter(Boolean));

  rows.push({
    query: testCase.query,
    records: top.length,
    precision_at_10: Number(precision.toFixed(2)),
    represented_sources: representedSources.size,
    available_sources: result.available_source_count,
    unavailable_sources: result.unavailable_source_count,
    top_result: top[0]?.title || 'No live record',
    coverage_warning: representedSources.size < 2 || result.available_source_count < 3,
    passed: top.length >= 5 && precision >= MIN_CASE_PRECISION,
  });
}

console.table(rows);
const averagePrecision = rows.reduce((sum, row) => sum + row.precision_at_10, 0) / rows.length;
const failedCases = rows.filter(row => !row.passed);
const coverageWarnings = rows.filter(row => row.coverage_warning);

console.log(`Average precision@${TOP_K}: ${averagePrecision.toFixed(2)}`);
console.log(`Cases passed: ${rows.length - failedCases.length}/${rows.length}`);
console.log(`Source coverage warnings: ${coverageWarnings.length}/${rows.length}`);

if (failedCases.length || averagePrecision < MIN_AVERAGE_PRECISION) {
  console.error('Relevance benchmark failed. Review ranking or source coverage before release.');
  process.exitCode = 1;
}
