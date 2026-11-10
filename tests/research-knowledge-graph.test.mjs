import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildResearchKnowledgeGraph,
  filterResearchKnowledgeGraph,
  getRelatedKnowledgeNodes,
} from '../src/lib/research-knowledge-graph.mjs';
import { searchOpenAlexWorks } from '../src/lib/eyra-api.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const openAlex = suffix => `https://openalex.org/${suffix}`;

function fixture() {
  return {
    projects: [{
      id: 'project-1',
      title: 'Sleep research',
      evidence_matrix: { annotations: { 'paper-1': { study_design: 'Longitudinal cohort' } } },
    }],
    papers: [
      {
        id: 'paper-1', source_id: openAlex('W1'), title: 'Sleep patterns', year: 2024,
        source: 'OpenAlex', url: 'https://doi.org/10.1234/one', project_id: 'project-1',
        authorships: [{ author_id: openAlex('A1'), author_name: 'Alex Researcher', institutions: [{ id: openAlex('I1'), name: 'Example University' }] }],
        openalex_topics: [{ id: openAlex('T1'), name: 'Sleep science' }],
        referenced_work_ids: [openAlex('W2'), openAlex('W404')],
      },
      {
        id: 'paper-2', source_id: openAlex('W2'), title: 'Circadian rhythms', year: 2022,
        source: 'OpenAlex', url: 'https://doi.org/10.1234/two', project_id: 'project-1',
        authorships: [
          { author_id: openAlex('A1'), author_name: 'Alex Researcher', institutions: [] },
          { author_id: openAlex('A2'), author_name: 'Alex Researcher', institutions: [] },
        ],
        openalex_topics: [{ id: openAlex('T1'), name: 'Sleep science' }],
        referenced_work_ids: [],
      },
    ],
    researchers: [{
      id: 'researcher-1', openalex_id: openAlex('A1'), name: 'Alex Researcher',
      institution: 'Example University', profile_url: openAlex('A1'),
      research_topics_source: 'OpenAlex publication topics',
      openalex_topics: [{ id: openAlex('T1'), name: 'Sleep science' }],
    }],
  };
}

test('graph uses stable OpenAlex IDs, project records and researcher-authored method notes', () => {
  const graph = buildResearchKnowledgeGraph(fixture());
  assert.ok(graph.nodes.some(node => node.id === 'project:project-1' && node.type === 'project'));
  assert.ok(graph.nodes.some(node => node.id === 'paper:paper-1' && node.type === 'paper'));
  assert.ok(graph.nodes.some(node => node.id === `author:${openAlex('A1')}` && node.type === 'researcher'));
  assert.ok(graph.nodes.some(node => node.type === 'institution' && node.label === 'Example University'));
  assert.ok(graph.nodes.some(node => node.type === 'topic' && node.label === 'Sleep science'));
  assert.ok(graph.nodes.some(node => node.type === 'methodology' && node.label === 'Longitudinal cohort' && /Researcher note/.test(node.provenance)));
  assert.ok(graph.edges.some(edge => edge.kind === 'project-paper' && edge.from === 'project:project-1'));
});

test('citation edges require a matching saved OpenAlex work and shared-topic links are marked inferred', () => {
  const graph = buildResearchKnowledgeGraph(fixture());
  assert.equal(graph.edges.filter(edge => edge.kind === 'citation').length, 1);
  assert.equal(graph.edges.find(edge => edge.kind === 'citation').to, 'paper:paper-2');
  assert.equal(graph.edges.some(edge => edge.to === 'paper:paper-404'), false);
  const similarity = graph.edges.find(edge => edge.kind === 'topic-similarity');
  assert.equal(similarity.inferred, true);
  assert.match(similarity.provenance, /not a citation or proof/);
});

test('shared-topic inference stays bounded for large saved collections', () => {
  const papers = Array.from({ length: 100 }, (_, index) => ({
    id: `paper-${index}`,
    title: `Paper ${index}`,
    openalex_topics: [{ id: openAlex('T10'), name: 'Shared topic' }],
  }));
  const graph = buildResearchKnowledgeGraph({ papers });
  assert.ok(graph.coverage.inferredTopicLinks <= papers.length * 3);
});

test('same display names do not merge distinct source authors and researchers match only exact OpenAlex IDs', () => {
  const graph = buildResearchKnowledgeGraph(fixture());
  assert.ok(graph.nodes.some(node => node.id === `author:${openAlex('A1')}`));
  assert.ok(graph.nodes.some(node => node.id === `author:${openAlex('A2')}`));
  assert.notEqual(`author:${openAlex('A1')}`, `author:${openAlex('A2')}`);
});

test('graph filtering keeps only visible endpoints and related navigation uses recorded links', () => {
  const graph = buildResearchKnowledgeGraph(fixture());
  const filtered = filterResearchKnowledgeGraph(graph, { types: ['paper'] });
  assert.ok(filtered.nodes.every(node => node.type === 'paper'));
  assert.ok(filtered.edges.every(edge => filtered.nodes.some(node => node.id === edge.from) && filtered.nodes.some(node => node.id === edge.to)));
  assert.deepEqual(filterResearchKnowledgeGraph(graph, { query: 'does not exist' }).nodes, []);
  const related = getRelatedKnowledgeNodes(graph, 'paper:paper-1');
  assert.ok(related.some(item => item.node.id === 'paper:paper-2' && item.edge.kind === 'citation'));
});

test('OpenAlex work metadata retains bounded authorship, indexed topics and reference IDs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [{
    id: openAlex('W123'),
    title: 'Source record',
    authorships: [{ author: { id: openAlex('A12'), display_name: 'Researcher A' }, institutions: [{ id: openAlex('I34'), display_name: 'University A' }] }],
    topics: [{ id: openAlex('T56'), display_name: 'Research topic' }],
    referenced_works: [openAlex('W99')],
  }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const [paper] = await searchOpenAlexWorks('source record', 1, 'relevance');
    assert.equal(paper.authorships[0].author_id, openAlex('A12'));
    assert.equal(paper.authorships[0].institutions[0].id, openAlex('I34'));
    assert.equal(paper.openalex_topics[0].id, openAlex('T56'));
    assert.deepEqual(paper.referenced_work_ids, [openAlex('W99')]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Knowledge Graph is routed behind authentication and available in the workspace tools menu', () => {
  const app = read('src/App.jsx');
  const layout = read('src/components/layout/AppLayout.jsx');
  assert.match(app, /<Route path="\/knowledge-graph" element=\{<ResearchKnowledgeGraph \/>\} \/>/);
  assert.match(layout, /label: 'Knowledge graph', path: '\/knowledge-graph'/);
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*<Route element=\{<AppLayout \/>\}>/);
});
