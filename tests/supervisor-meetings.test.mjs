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

test('PhD invitation status requires an explicit user-managed acceptance record', () => {
  const form = readFileSync(new URL('../src/components/meetings/MeetingForm.jsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/meetings/MeetingDetail.jsx', import.meta.url), 'utf8');
  assert.match(form, /invitation_status: 'not_sent'/);
  assert.match(form, /value="awaiting_reply"/);
  assert.match(form, /Recipient explicitly accepted/);
  assert.match(form, /Only mark accepted after receiving a direct confirmation/);
  assert.match(detail, /meeting\.invitation_status === 'accepted'/);
  assert.match(detail, /invitations and acceptance are not automatically verified/);
});

test('calendar proposal is tentative and contains meeting details without invented RSVP', async () => {
  const { createMeetingCalendarDraft } = await import('../src/lib/meeting-invitation.js');
  const invitation = createMeetingCalendarDraft({
    id: 'proposal-1', title: 'PhD discussion', date: '2026-11-03', time: '14:30',
    duration_minutes: 45, agenda: 'Discuss research alignment', meeting_link: 'https://meet.jit.si/eylo-demo',
  });
  assert.match(invitation, /BEGIN:VCALENDAR/);
  assert.match(invitation, /DTSTART:\d{8}T\d{6}Z/);
  assert.match(invitation, /DTEND:\d{8}T\d{6}Z/);
  assert.match(invitation, /STATUS:TENTATIVE/);
  assert.match(invitation, /Confirmation required/);
  assert.doesNotMatch(invitation, /ATTENDEE/);
  assert.throws(() => createMeetingCalendarDraft({date:'',time:''}), /valid meeting date and time/);
  assert.throws(() => createMeetingCalendarDraft({date:'2026-02-30',time:'14:00'}), /Invalid meeting date/);
  assert.throws(() => createMeetingCalendarDraft({date:'2026-11-03',time:'25:30'}), /Invalid meeting date/);
});

test('accepted supervisor meetings require a user-recorded confirmation reference', () => {
  const form = readFileSync(new URL('../src/components/meetings/MeetingForm.jsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/meetings/MeetingDetail.jsx', import.meta.url), 'utf8');
  assert.match(form, /invitation_status === 'accepted' && !String\(form\.confirmation_reference/);
  assert.match(form, /Record how the recipient confirmed the meeting/);
  assert.match(form, /confirmation_reference: ''/);
  assert.match(detail, /meeting\.confirmation_reference/);
});

test('robotics PhD discovery shows evidenced companies without inventing a doctoral place', async () => {
  const { findIndustryResearchLabs } = await import('../src/lib/industry-research-labs.js');
  const robotics = findIndustryResearchLabs('robotics');
  assert.ok(robotics.length >= 3);
  assert.ok(robotics.some(lab => lab.name.includes('NVIDIA')));
  assert.ok(robotics.every(lab => lab.url.startsWith('https://')));
  assert.ok(robotics.every(lab => !lab.phdVacancyVerified && !lab.supervisionVerified));
  assert.ok(findIndustryResearchLabs('ρομποτική').length >= 3);
  assert.equal(findIndustryResearchLabs('biochemistry').length, 0);
  assert.equal(findIndustryResearchLabs('robotics', 'DE').length, 0);
  const researchers = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(researchers, /Industry robotics research labs/);
  assert.match(researchers, /not confirmed PhD supervisors/);
});

test('worldwide researcher discovery supports paging and six-hour refresh without claiming all professors', () => {
  const researchers = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/lib/eyra-api.js', import.meta.url), 'utf8');
  assert.match(researchers, /6 \* 60 \* 60 \* 1000/);
  assert.match(researchers, /Load more researchers worldwide/);
  assert.match(researchers, /Not a complete directory of every professor/);
  assert.match(api, /strictOptions\.page/);
  assert.match(api, /fetchResearchSource\('openalex_authors', query, limit, 'relevance', directUrl, \{ page, country \}\)/);
  assert.match(api, /&page=\$\{page\}/);
});

test('worldwide scholar refresh catches up after browser tab resumes without repeated active requests', () => {
  const researchers = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(researchers, /lastFetchAt = useRef\(0\)/);
  assert.match(researchers, /visibilitychange/);
  assert.match(researchers, /Date\.now\(\) - lastFetchAt\.current >= REFRESH_INTERVAL_MS/);
  assert.match(researchers, /loadingRef\.current/);
  assert.match(researchers, /clearInterval\(timer\)/);
});

test('author discovery requests server-cached worldwide pages for six hours', () => {
  const proxy = readFileSync(new URL('../api/discovery.js', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/lib/eyra-api.js', import.meta.url), 'utf8');
  assert.match(proxy, /page: String\(page\)/);
  assert.match(proxy, /s-maxage=21600/);
  assert.match(proxy, /Page must be between 1 and 200/);
  assert.match(client, /params\.set\('page', String\(page\)\)/);
});

test('worldwide PhD author search can filter by institution country without implying faculty verification', () => {
  const proxy = readFileSync(new URL('../api/discovery.js', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/lib/eyra-api.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(proxy, /Country must be an ISO two-letter code/);
  assert.match(proxy, /last_known_institutions\.country_code/);
  assert.match(client, /strictOptions\.country/);
  assert.match(ui, /Worldwide — all countries/);
  assert.match(ui, /indexed institutional affiliation/);
  assert.match(ui, /country: countryFilter/);
});
