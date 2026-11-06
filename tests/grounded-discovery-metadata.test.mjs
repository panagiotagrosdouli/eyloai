import test from 'node:test';
import assert from 'node:assert/strict';
import { groundedDiscoveryMetadata, verifiedResearchKeywords } from '../src/lib/grounded-discovery-metadata.mjs';
import { readFileSync } from 'node:fs';

const papers = [
  { title: 'Machine Learning for Traffic Flow', year: 2022, summary: 'We analyze vehicle speeds at urban intersections.' },
  { title: 'Traffic camera benchmarks', year: 2024, summary: 'The study uses pedestrian trajectory data.' },
  { title: 'Cross-modal trajectories', year: 2023, summary: 'An evaluation of sensor fusion.' },
];
const researchers = [
  { name: 'Researcher One', citation_count: 4 },
  { name: 'Researcher Two', citation_count: 60 },
];

test('discovery statistics use retrieved records, not generated counts or rankings', () => {
  const result = groundedDiscoveryMetadata(papers, researchers, ['machine learning'], 2026);
  assert.deepEqual(result.data_summary, {
    total_papers: 3, total_researchers: 2,
    date_range: '2022–2024', top_researcher: 'Researcher Two',
  });
  assert.equal(result.confidence_overall, 'MEDIUM');
});

test('only keywords found as words in real titles or abstracts survive', () => {
  assert.deepEqual(verifiedResearchKeywords([
    'Machine Learning', 'never-present phrase', 'traffic',
    'Learning', 'AI', 'MACHINE   LEARNING', 'vehicle speeds',
  ], papers), ['Machine Learning', 'traffic', 'Learning', 'vehicle speeds']);
  assert.deepEqual(verifiedResearchKeywords(['AI'], [
    { title: 'Brain imaging', summary: '' },
  ]), [], 'AI must not match inside brain');
});

test('Unicode, punctuation, whitespace and deduplication are handled safely', () => {
  assert.deepEqual(verifiedResearchKeywords([
    'τροχιά  πεζών', 'τροχιά πεζών', 'μη-γραμμική', 'ανύπαρκτη',
  ], [{ title: 'Μη γραμμική μέθοδος', summary: 'Ανάλυση τροχιά πεζών.' }]), [
    'τροχιά  πεζών', 'μη-γραμμική',
  ]);
});

test('missing publication metadata and unranked authors are not invented', () => {
  const result = groundedDiscoveryMetadata([
    { title: 'No year' }, { year: 0 }, { year: 9999 },
  ], [{ name: 'No citation count' }], ['invented keyword'], 2026);
  assert.equal(result.data_summary.date_range, 'Not available');
  assert.equal(result.data_summary.top_researcher, '');
  assert.deepEqual(result.keywords, []);
  assert.equal(result.confidence_overall, 'MEDIUM');
  assert.equal(groundedDiscoveryMetadata([]).confidence_overall, 'LOW');
  assert.equal(groundedDiscoveryMetadata(new Array(8).fill({})).confidence_overall, 'HIGH');
});

test('the production discovery result overrides model-provided metadata with source-derived values', () => {
  const source = readFileSync(new URL('../src/lib/eyra-engine.js', import.meta.url), 'utf8');
  assert.match(source, /\.\.\.aiAnalysis,\s+\.\.\.groundedDiscoveryMetadata\(papers, researchers, aiAnalysis\.keywords\)/);
  assert.match(source, /import \{ groundedDiscoveryMetadata \} from '.\/grounded-discovery-metadata\.mjs'/);
});
