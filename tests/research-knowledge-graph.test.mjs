import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildResearchKnowledgeGraph,
  filterResearchKnowledgeGraph,
  getRelatedKnowledgeNodes,
  selectResearchGraphNodes,
} from '../src/lib/research-knowledge-graph.mjs';
import { loadResearchGraphCollections } from '../src/lib/research-graph-collections.mjs';
import { searchOpenAlexWorks } from '../src/lib/eyra-api.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const openAlex = suffix => `https://openalex.org/${suffix}`;

test('workspace nodes use exact canonical links and only explicit owned-project relations', () => {
  const graph = buildResearchKnowledgeGraph({
    projects: [{ id: 'p1', title: 'My project' }],
    notes: [{ id: 'n/1?', title: 'My interpretation', content: 'Do not copy my full draft', tags: ['reading'], project_id: 'p1' }, { id: 'archived', archived_at: '2026-11-01' }, { id: 'orphan', title: 'My unrelated note', project_id: 'unloaded-project' }],
    tasks: [{ id: 't1', title: 'Check the source', project_id: 'p1', status: 'pending' }, { id: '', title: 'No saved identity' }],
  });
  assert.equal(graph.coverage.notes, 2);
  assert.equal(graph.coverage.tasks, 1);
  const note = graph.nodes.find(node => node.id === 'note:n/1?');
  assert.equal(note.href, '/notes?focus=n%2F1%3F');
  assert.equal(note.details, 'reading');
  assert.equal(JSON.stringify(graph).includes('Do not copy my full draft'), false);
  assert.equal(graph.nodes.find(node => node.type === 'task').href, '/life?focus=t1');
  assert.equal(graph.edges.filter(edge => edge.kind.startsWith('project-')).length, 2);
  assert.ok(graph.edges.every(edge => !edge.inferred && !edge.source_url));
  assert.equal(graph.edges.some(edge => edge.to === 'note:orphan'), false);
  assert.match(note.provenance, /not an independently verified publication/);
});

test('bounded graph selection preserves rare record types instead of hiding them behind projects', () => {
  const rows = [...Array.from({ length: 250 }, (_, i) => ({ id: 'p' + i, type: 'project' })), { id: 'n1', type: 'note' }, { id: 'w1', type: 'paper' }, { id: 't1', type: 'task' }];
  const selected = selectResearchGraphNodes(rows);
  assert.equal(selected.length, 120);
  assert.ok(['n1', 'w1', 't1'].every(id => selected.some(node => node.id === id)));
  assert.equal(new Set(selected.map(node => node.id)).size, 120);
  assert.equal(selectResearchGraphNodes(rows, -10).length, 0);
});

test('graph collection reads bind the expected owner, bound coverage and report partial failure', async () => {
  const calls = [];
  const entities = Object.fromEntries(['SavedPaper', 'SavedResearcher', 'Project', 'Note', 'LifeTask'].map(name => [name, { list: async (...args) => { calls.push([name, ...args]); if (name === 'LifeTask') throw new Error('private upstream detail'); return Array.from({ length: name === 'Note' ? 251 : 1 }, (_, i) => ({ id: name + i })); } }]));
  const result = await loadResearchGraphCollections({ entities, ownerId: 'owner-a' });
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call[2] === 251 && call[3] === 'owner-a'));
  assert.equal(result.collections.notes.length, 250);
  assert.deepEqual(result.unavailable, ['tasks']);
  assert.deepEqual(result.truncated, ['notes']);
  assert.equal(result.allUnavailable, false);
  assert.equal(JSON.stringify(result).includes('private upstream detail'), false);
  await assert.rejects(loadResearchGraphCollections({ entities, ownerId: '' }), /Sign in/);
  assert.equal(calls.length, 5, 'missing identity does not read any collections');
});

test('invalid and unavailable collections never produce fake empty-success coverage', async () => {
  const entities = Object.fromEntries(['SavedPaper', 'SavedResearcher', 'Project', 'Note', 'LifeTask'].map(name => [name, { list: async () => name === 'Note' ? { html: 'SPA fallback' } : Promise.reject(new Error('offline')) }]));
  const result = await loadResearchGraphCollections({ entities, ownerId: 'owner-a' });
  assert.equal(result.allUnavailable, true);
  assert.equal(result.unavailable.length, 5);
  assert.ok(Object.values(result.collections).every(rows => rows.length === 0));
});

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
