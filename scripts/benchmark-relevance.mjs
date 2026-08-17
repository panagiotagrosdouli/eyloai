import { rankPaperRecords } from '../src/lib/eyra-api.js';

const CASES = [
  {
    query: 'robotics for independent ageing',
    distractors: [
      'Robotics systems: a highly cited general survey',
      'Independent ageing policy without robotics',
      'Industrial robotics for warehouse automation',
      'Ageing mechanisms in cellular biology',
      'Robot navigation in outdoor environments',
    ],
  },
  {
    query: 'AI for early cancer detection',
    distractors: [
      'AI for early defect detection in manufacturing',
      'Cancer treatment pathways without artificial intelligence',
      'Machine learning for late-stage heart disease',
      'Early anomaly detection in computer networks',
      'Artificial intelligence in clinical administration',
    ],
  },
  {
    query: 'climate adaptation for coastal cities',
    distractors: [
      'Climate adaptation in inland cities',
      'Coastal tourism management without climate planning',
      'Urban climate mitigation strategies',
      'Adaptation finance for rural agriculture',
      'Sea-level monitoring outside cities',
    ],
  },
  {
    query: 'trustworthy AI in higher education',
    distractors: [
      'Trustworthy AI in financial services',
      'Artificial intelligence in primary education',
      'Higher education digital transformation without AI',
      'Responsible automation in manufacturing',
      'Student trust in conventional online learning',
    ],
  },
  {
    query: 'uncertainty-aware trajectory prediction vulnerable road users',
    distractors: [
      'Uncertainty-aware trajectory prediction for aircraft',
      'Vulnerable road user injury statistics',
      'Deterministic vehicle trajectory prediction',
      'Confidence estimation for image classification',
      'Pedestrian detection without motion prediction',
    ],
  },
];

const SOURCES = ['OpenAlex', 'Crossref', 'Europe PMC', 'Semantic Scholar'];

function makeCandidates(testCase) {
  const relevant = Array.from({ length: 5 }, (_, index) => ({
    id: `${testCase.query}-relevant-${index}`,
    title: `${testCase.query}: evidence study ${index + 1}`,
    summary: `A focused study of ${testCase.query}, including methods, evaluation and limitations.`,
    year: new Date().getFullYear() - index,
    cited_by_count: 20 + index,
    open_access: index % 2 === 0,
    source_index: SOURCES[index % SOURCES.length],
    _source_rank: index,
    expected_relevant: true,
  }));

  const distractors = testCase.distractors.map((title, index) => ({
    id: `${testCase.query}-distractor-${index}`,
    title,
    summary: title,
    year: new Date().getFullYear() - 1,
    cited_by_count: 5_000 - index,
    source_index: SOURCES[index % SOURCES.length],
    _source_rank: 0,
    expected_relevant: false,
  }));

  return [...distractors, ...relevant];
}

const rows = CASES.map(testCase => {
  const ranked = rankPaperRecords(makeCandidates(testCase), testCase.query, {
    level: 'researcher',
    goal: 'review',
    recency: 'balanced',
    limit: 5,
  });
  const relevant = ranked.filter(paper => paper.expected_relevant).length;
  const precision = ranked.length ? relevant / ranked.length : 0;
  const representedSources = new Set(ranked.map(paper => paper.source_index)).size;

  return {
    query: testCase.query,
    returned: ranked.length,
    precision_at_5: Number(precision.toFixed(2)),
    represented_sources: representedSources,
    passed: ranked.length === 5 && precision === 1 && representedSources >= 3,
  };
});

const metadataNoiseResult = rankPaperRecords([
  {
    id: 'crossref-base',
    doi: '10.32920/25613349',
    title: 'Pedestrian Trajectory Prediction with Deep Learning Transformers and Kalman Filters',
    summary: 'Pedestrian trajectory prediction methods and evaluation.',
    source_index: 'Crossref',
  },
  {
    id: 'crossref-version',
    doi: '10.32920/25613349.v1',
    title: 'Pedestrian Trajectory Prediction with Deep Learning Transformers and Kalman Filters',
    summary: 'Pedestrian trajectory prediction methods and evaluation.',
    source_index: 'Crossref',
  },
  {
    id: 'crossref-table',
    doi: '10.7717/peerjcs.1641/table-1',
    title: 'Table 1: Experimental settings of the pedestrian trajectory prediction.',
    summary: 'Pedestrian trajectory prediction.',
    source_index: 'Crossref',
  },
  {
    id: 'crossref-figure',
    doi: '10.7717/peerjcs.1641/fig-2',
    title: 'Figure 2: The flow of pedestrian trajectory prediction by a mobile robot.',
    summary: 'Pedestrian trajectory prediction.',
    source_index: 'Crossref',
  },
], 'pedestrian trajectory prediction', {
  level: 'student',
  goal: 'thesis',
  recency: 'balanced',
  limit: 10,
});
const metadataQualityPassed = metadataNoiseResult.length === 1
  && metadataNoiseResult[0].doi === '10.32920/25613349';

console.table(rows);
const failed = rows.filter(row => !row.passed);
console.log(`Deterministic ranking cases passed: ${rows.length - failed.length}/${rows.length}`);
console.log(`Metadata normalization regression: ${metadataQualityPassed ? 'passed' : 'failed'}`);

if (failed.length || !metadataQualityPassed) {
  console.error('Discovery quality benchmark failed.');
  process.exitCode = 1;
}
