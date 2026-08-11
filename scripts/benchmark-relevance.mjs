import { searchAllPapersWithStatus } from '../src/lib/eyra-api.js';

const CASES = [
  {
    query: 'robotics for independent ageing',
    anchors: ['robot', 'assist', 'ageing', 'aging', 'older adult', 'elderly', 'independent living'],
  },
  {
    query: 'AI for early cancer detection',
    anchors: ['cancer', 'tumor', 'tumour', 'oncology', 'screen', 'diagnos', 'detect'],
  },
  {
    query: 'climate adaptation for coastal cities',
    anchors: ['climate', 'coast', 'sea level', 'flood', 'adapt', 'resilien'],
  },
  {
    query: 'trustworthy AI in higher education',
    anchors: ['trust', 'artificial intelligence', 'education', 'universit', 'student', 'academic'],
  },
  {
    query: 'uncertainty-aware trajectory prediction vulnerable road users',
    anchors: ['uncertain', 'trajectory', 'pedestrian', 'cyclist', 'road user', 'prediction'],
  },
];

const TOP_K = 10;
const MIN_CASE_PRECISION = 0.6;
const MIN_AVERAGE_PRECISION = 0.7;

function matchesCase(paper, anchors) {
  const text = `${paper.title || ''} ${paper.summary || ''}`.toLowerCase();
  return anchors.some(anchor => text.includes(anchor));
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
  const relevant = top.filter(paper => matchesCase(paper, testCase.anchors)).length;
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
