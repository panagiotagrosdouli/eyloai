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

test('CV matching accepts common country names and ISO codes', async () => {
  const { normalizeCountry } = await import('../src/lib/supervisor-matching.js');
  assert.equal(normalizeCountry('Greece'), 'GR');
  assert.equal(normalizeCountry('Ελλάδα'), 'GR');
  assert.equal(normalizeCountry('Germany'), 'DE');
  assert.equal(normalizeCountry('US'), 'US');
  assert.equal(normalizeCountry(''), '');
  const match = scoreSupervisorCandidate({ country: 'GR', research_areas: 'Robotics' }, { country: 'Greece', cv_text: 'Robotics research work' });
  assert.equal(match.countryMatch, true);
});

test('researcher CV entry permits safe paste of text copied from PDF or DOCX', () => {
  const source = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(source, /id="supervisor-cv-text"/);
  assert.match(source, /value=\{cvText\}/);
  assert.match(source, /PDF and DOCX are read in your browser/);
});

test('local CV document parser accepts supported file types and enforces limits', async () => {
  const { validateCvDocument, extractCvText } = await import('../src/lib/cv-extraction.js');
  assert.equal(validateCvDocument({name:'candidate.pdf',size:1200}), '');
  assert.equal(validateCvDocument({name:'candidate.docx',size:1200}), '');
  assert.match(validateCvDocument({name:'candidate.exe',size:1200}), /PDF, DOCX/);
  assert.match(validateCvDocument({name:'candidate.pdf',size:7 * 1024 * 1024}), /under 5 MB/);
  const text = await extractCvText({name:'candidate.txt',size:90,text:async()=> 'Research in artificial intelligence and robotics, with scientific publications.'});
  assert.match(text, /artificial intelligence/);
  await assert.rejects(extractCvText({name:'candidate.txt',size:40,text:async()=> 'small'}), /too little readable text/);
});

test('PhD discovery carries research context into an explicitly unconfirmed meeting plan', () => {
  const researchers = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  const meetings = readFileSync(new URL('../src/pages/Meetings.jsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/meetings/MeetingForm.jsx', import.meta.url), 'utf8');
  assert.match(researchers, /type=phd_supervision&topic=/);
  assert.match(researchers, /Prospective PhD research supervision inquiry/);
  assert.match(meetings, /phdDiscussion = searchParams\.get\('type'\) === 'phd_supervision'/);
  assert.match(meetings, /no invitation or booking has been sent/);
  assert.match(form, /value: 'phd_supervision'/);
});

test('meeting invitation drafts require a verified email and do not imply acceptance', () => {
  const source = readFileSync(new URL('../src/components/meetings/MeetingDetail.jsx', import.meta.url), 'utf8');
  assert.match(source, /Request a meeting by email/);
  assert.match(source, /Set a meeting date and time before preparing the invitation/);
  assert.match(source, /mailto:/);
  assert.match(source, /This is a request, not a confirmed booking/);
  assert.match(source, /does not send the message or claim the researcher accepted/);
});
