import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildResearchJourney, researchJourneyLinks } from '../src/lib/research-journey.mjs';

const project = { id: 'p one/unsafe?', title: 'Coastal methods', goal: 'Review coastal evidence' };
const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');

test('research journey never equates saved fields with scientific verification', () => {
  const stages = buildResearchJourney(project, { linkedPapers: 4, papersLoaded: true });
  assert.deepEqual(stages.map(stage => stage.id), ['question', 'sources', 'gaps', 'protocol', 'writing']);
  assert.equal(stages[1].statusText, '4 linked papers');
  assert.equal(stages[2].status, 'review');
  assert.match(stages[2].caveat, /never proof/);
  assert.match(stages[3].caveat, /not methodological quality/);
  assert.match(stages[4].caveat, /not checked for citations/);
});

test('unknown and failed evidence reads cannot look like an empty project', () => {
  const unknown = buildResearchJourney(project, { linkedPapers: 0, papersLoaded: false });
  assert.equal(unknown[1].status, 'unknown');
  assert.match(unknown[1].statusText, /unavailable/);
  assert.equal(buildResearchJourney(project, { linkedPapers: -2, papersLoaded: true })[1].status, 'unknown');
  const empty = buildResearchJourney(project, { linkedPapers: 0, papersLoaded: true });
  assert.equal(empty[1].status, 'next');
  assert.equal(empty[1].statusText, '0 linked papers');
});

test('protocol and thesis progress describe actual recorded fields only', () => {
  const ready = buildResearchJourney({ ...project,
    review_protocol: {
      question: 'RQ', search_databases: 'Crossref', search_strings: 'A AND B',
      inclusion_criteria: 'Peer reviewed', exclusion_criteria: 'Non-study',
    },
    thesis_outline: { chapters: [{ id: 'c1' }, { id: 'c2' }] },
  }, { linkedPapers: 1, papersLoaded: true });
  assert.equal(ready[3].statusText, '5 of 5 key method fields recorded');
  assert.equal(ready[4].statusText, '2 outlined chapters');
  assert.match(ready[3].caveat, /PRISMA/);
  assert.equal(buildResearchJourney({ ...project, review_protocol: { question: 'RQ' } })[3].statusText, '1 of 5 key method fields recorded');
});

test('all project deep links encode identifiers rather than allowing route traversal', () => {
  const links = researchJourneyLinks(project.id);
  for (const key of ['project', 'gaps', 'review', 'thesis']) {
    assert.ok(links[key].includes(encodeURIComponent(project.id)), key);
    assert.ok(!links[key].includes('/unsafe?'), key);
  }
  assert.equal(buildResearchJourney(null).length, 0);
  assert.equal(links.gaps.split('?')[0], '/research-gaps');
});

test('research journey is protected and discoverable across existing workflows', () => {
  const app = read('App.jsx');
  const home = read('components/dashboard/EyraHome.jsx');
  const tools = read('pages/ProductTools.jsx');
  const projectPage = read('pages/ProjectDetail.jsx');
  const gaps = read('pages/ResearchGaps.jsx');
  assert.ok(app.includes('path="/research-journey" element={<ResearchJourney />}'));
  assert.ok(home.includes("href: '/research-journey'"));
  assert.ok(tools.includes("href: '/research-journey'"));
  assert.ok(projectPage.includes("'/research-journey?project_id='"));
  assert.ok(gaps.includes("base44.entities.SavedPaper.filter({ project_id: requestedProjectId }"));
  assert.ok(gaps.includes('Project.get(requestedProjectId)'));
});

test('research journey handles read errors without inventing results or mutating projects', () => {
  const page = read('pages/ResearchJourney.jsx');
  assert.ok(page.includes('base44.entities.Project.get(selectedId)'));
  assert.ok(page.includes('base44.entities.SavedPaper.filter({ project_id: chosen.id }'));
  assert.ok(page.includes('Project papers could not be loaded'));
  assert.ok(page.includes('No conclusion about evidence availability'));
  assert.ok(page.includes('role="alert"'));
  assert.ok(page.includes('eylo:open-eyra'));
  assert.ok(!page.includes('SavedPaper.create('));
  assert.ok(!page.includes('Project.update('));
});
