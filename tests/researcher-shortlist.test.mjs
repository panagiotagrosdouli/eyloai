import test from 'node:test';
import assert from 'node:assert/strict';
import { saveResearcherCandidate } from '../src/lib/researcher-shortlist.mjs';

const researcher = {
  id: 'https://openalex.org/A123',
  name: 'Researcher Example',
  institution: 'Example University',
  country: 'GB',
  research_areas: 'climate adaptation',
  works_count: 12,
  citation_count: 34,
  profile_url: 'https://openalex.org/A123',
};

function repository(existing = []) {
  const saved = [...existing];
  const updates = [];
  return {
    saved,
    updates,
    entities: {
      SavedResearcher: {
        async filter() { return saved; },
        async create(record) { saved.push(record); },
        async update(id, patch) { updates.push({ id, patch }); },
      },
    },
  };
}

test('saves a verified OpenAlex researcher to the user Library and selected project', async () => {
  const store = repository();
  const project = { id: 'project-1', title: 'Climate resilience' };

  const result = await saveResearcherCandidate({ entities: store.entities, researcher, project });

  assert.deepEqual(result, { status: 'saved', projectId: project.id });
  assert.equal(store.saved.length, 1);
  assert.equal(store.saved[0].openalex_id, researcher.id);
  assert.equal(store.saved[0].source, 'OpenAlex');
  assert.equal(store.saved[0].project_id, project.id);
  assert.equal(store.saved[0].project_title, project.title);
});

test('links an existing Library record to a project without duplicating it', async () => {
  const store = repository([{ id: 'researcher-row', openalex_id: researcher.id }]);

  const result = await saveResearcherCandidate({
    entities: store.entities,
    researcher,
    project: { id: 'project-2', title: 'Coastal systems' },
  });

  assert.deepEqual(result, { status: 'linked', projectId: 'project-2' });
  assert.equal(store.saved.length, 1);
  assert.deepEqual(store.updates, [{ id: 'researcher-row', patch: { project_id: 'project-2', project_title: 'Coastal systems' } }]);
});

test('does not move a researcher already linked to a different project', async () => {
  const store = repository([{ id: 'researcher-row', openalex_id: researcher.id, project_id: 'project-1' }]);

  const result = await saveResearcherCandidate({
    entities: store.entities,
    researcher,
    project: { id: 'project-2', title: 'Different project' },
  });

  assert.deepEqual(result, { status: 'already_linked', projectId: 'project-1' });
  assert.deepEqual(store.updates, []);
  assert.equal(store.saved.length, 1);
});

test('requires a stable OpenAlex identity before saving', async () => {
  const store = repository();

  await assert.rejects(
    saveResearcherCandidate({ entities: store.entities, researcher: { name: 'Unverified person' } }),
    /no OpenAlex identifier/,
  );
  assert.equal(store.saved.length, 0);
});
