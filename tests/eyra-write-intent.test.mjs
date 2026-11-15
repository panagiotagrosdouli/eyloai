import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedEyraWrites } from '../src/lib/eyra-write-intent.mjs';

test('EYRA classifies only explicit positive record writes', () => {
  assert.deepEqual(requestedEyraWrites('Create a project about research.'), { project: true, paper: false });
  assert.deepEqual(requestedEyraWrites('Save this paper to my Library.'), { project: false, paper: true });
  assert.deepEqual(requestedEyraWrites('What makes a good project?'), { project: false, paper: false });
  assert.deepEqual(requestedEyraWrites('Review the metadata for DOI 10.1000/test.'), { project: false, paper: false });
  assert.deepEqual(requestedEyraWrites('Create a project and save this paper.'), { project: true, paper: true });
});

test('EYRA supports positive Greek writes and refuses negations', () => {
  assert.equal(requestedEyraWrites('Δημιούργησε ένα νέο έργο για την έρευνά μου.').project, true);
  assert.equal(requestedEyraWrites('Φτιάξε ένα έργο για το διδακτορικό.').project, true);
  assert.equal(requestedEyraWrites('Αποθήκευσε αυτό το άρθρο.').paper, true);
  assert.deepEqual(requestedEyraWrites('Μην αποθήκευσε το άρθρο.'), { project: false, paper: false });
  assert.deepEqual(requestedEyraWrites('Do not create a project.'), { project: false, paper: false });
});

test('invalid or overly large requests never imply write authorization', () => {
  assert.deepEqual(requestedEyraWrites({ text: 'Create a project' }), { project: false, paper: false });
  assert.deepEqual(requestedEyraWrites('Create a project ' + 'x'.repeat(2000)), { project: false, paper: false });
  assert.deepEqual(requestedEyraWrites(''), { project: false, paper: false });
});
