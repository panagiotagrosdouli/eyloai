import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchRecord, validateResearchRecord, readResearchRecords, researchRecordPatch, exportResearchRecords } from '../src/lib/research-records.mjs';
const id = 'a0000000-0000-4000-8000-000000000001';
const entry = (kind = 'journal') => ({ ...createResearchRecord(kind, id, '2026-11-13'), title: 'Private record', observation: 'Observed measurements', hypothesis: 'A testable hypothesis', method: 'Predefined comparison', venue: 'User-supplied venue' });
test('project patches preserve independent workspaces and unknown record metadata', () => {
 const journal = { ...entry(), future_metadata: { preserved: true } };
 const project = { research_journal: [journal], experiment_records: [], unrelated: 'keep' };
 const replacement = { ...journal, interpretation: 'Uncertain' };
 const patch = researchRecordPatch('journal', project, replacement);
 assert.deepEqual(Object.keys(patch), ['research_journal']);
 assert.equal(project.research_journal[0].interpretation, '');
 assert.equal(patch.research_journal[0].future_metadata.preserved, true);
});
test('invalid dates, status, overlong text, unsafe links and unsupported versions fail closed', () => {
 for (const patch of [{ date: '2026-02-30' }, { due_date: '2026-13-01' }, { status: 'verified_by_publisher' }, { title: 'x'.repeat(161) }, { observation: '' }, { source_url: 'javascript:alert(1)' }, { source_url: 'https://secret:password@example.org' }, { version: 2 }, { id: 'bad' }]) assert.throws(() => validateResearchRecord('journal', { ...entry(), ...patch }));
});
test('experiments require observed results to complete and published records require a reference', () => {
 assert.throws(() => validateResearchRecord('experiments', { ...entry('experiments'), status: 'completed' }), /observed result/);
 assert.doesNotThrow(() => validateResearchRecord('experiments', { ...entry('experiments'), status: 'completed', result: 'No difference observed' }));
 assert.throws(() => validateResearchRecord('publications', { ...entry('publications'), status: 'published' }), /reference/);
 assert.doesNotThrow(() => validateResearchRecord('publications', { ...entry('publications'), status: 'published', reference: '10.1234/user-supplied' }));
});
test('corrupt, duplicate and over-budget stored collections cannot be silently overwritten', () => {
 for (const rows of [{}, [entry(), entry()], [entry(), { ...entry(), version: 2 }], Array(101).fill(entry())]) assert.throws(() => researchRecordPatch('journal', { research_journal: rows }, entry()));
 const rows = Array.from({ length: 100 }, (_, i) => ({ ...entry(), id: `a0000000-0000-4000-8000-${String(i).padStart(12,'0')}` }));
 assert.throws(() => researchRecordPatch('journal', { research_journal: rows }, { ...entry(), id: 'b0000000-0000-4000-8000-000000000001' }), /100 records/);
 assert.equal(researchRecordPatch('journal', { research_journal: rows }, rows[0]).research_journal.length, 100);
 const richRows = rows.map(row => ({ ...row, observation: 'α'.repeat(6000) }));
 assert.throws(() => readResearchRecords('journal', { research_journal: richRows }), /256 KiB/);
});
test('deletion removes the exact record and portable export is scoped and disclosed', () => {
 const project = { id: 'project-id', title: 'Owner project', research_journal: [entry()], unrelated: 'private other data' };
 assert.deepEqual(researchRecordPatch('journal', project, entry(), true), { research_journal: [] });
 assert.throws(() => researchRecordPatch('journal', {}, entry(), true), /no longer exists/);
 const out = exportResearchRecords('journal', project);
 assert.equal(out.records.length, 1); assert.equal(out.project.id, project.id);
 assert.equal('unrelated' in out, false); assert.match(out.disclosure, /not an immutable/);
 assert.deepEqual(readResearchRecords('experiments', project), []);
 assert.throws(() => readResearchRecords('unknown', project));
});
