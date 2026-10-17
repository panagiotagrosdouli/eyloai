import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreSupervisorCandidate, validateCvTextFile } from '../src/lib/supervisor-matching.js';

test('PhD candidate scoring uses profile interest and explicit matching country code', () => {
  const profile = { research_interests: 'Computer Vision', bio: 'Research on autonomous robotics', country: 'GR' };
  const matching = scoreSupervisorCandidate({ research_areas: 'Computer Vision, Robotics', country: 'GR' }, profile);
  const unrelated = scoreSupervisorCandidate({ research_areas: 'Biochemistry', country: 'DE' }, profile);
  assert.ok(matching.score > unrelated.score);
  assert.equal(matching.countryMatch, true);
  assert.ok(matching.overlaps.includes('computer') || matching.overlaps.includes('vision'));
});

test('missing affiliation or different country is never presented as verified location match', () => {
  const result = scoreSupervisorCandidate({ research_areas: 'Artificial intelligence', country: '' }, { country: 'GR' });
  assert.equal(result.countryMatch, false);
});

test('researcher search exposes profile matching with source limitations', () => {
  const source = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(source, /Find candidates for my profile/);
  assert.match(source, /scoreSupervisorCandidate/);
  assert.match(source, /does not verify academic rank, PhD supervision availability/);
});

test('EYLO supports explicit opt-in in-app video and a separate external fallback', () => {
  const source = readFileSync(new URL('../src/components/meetings/MeetingDetail.jsx', import.meta.url), 'utf8');
  assert.match(source, /Join inside EYLO/);
  assert.match(source, /Open call externally/);
  assert.match(source, /hostname === 'meet\.jit\.si'/);
  assert.match(source, /inAppCall && embeddedRoom/);
  assert.match(source, /third-party service/);
});

test('CV matching uses uploaded local text without claiming verified supervision', () => {
  const candidate = { research_areas: 'Computational Biology, Machine Learning', country: 'GR' };
  const match = scoreSupervisorCandidate(candidate, { cv_text: 'Computational Biology machine learning research', country: 'GR' });
  assert.ok(match.overlaps.includes('computational'));
  assert.equal(validateCvTextFile({ name: 'resume.txt', size: 2500 }), '');
  assert.match(validateCvTextFile({ name: 'resume.pdf', size: 2500 }), /PDF and DOCX extraction are not enabled/);
  assert.match(validateCvTextFile({ name: 'resume.txt', size: 200000 }), /too large/);
});
