import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LITERATURE_REVIEW_SECTIONS,
  bibliographyForSelectedPapers,
  buildLiteratureReviewPrompt,
  exportLiteratureReviewMarkdown,
  hasLiteratureReviewSaveReceipt,
  projectLinkedPapers,
  validateLiteratureReviewDraft,
} from '../src/lib/literature-review-builder.mjs';

const papers = [
  { id: 'paper-a', project_id: 'project-1', title: 'Study A', authors: 'A. Author', year: 2024, source: 'Journal', summary: 'Abstract A', doi: '10.1234/test-a', url: 'https://example.org/a' },
  { id: 'paper-b', project_id: 'project-1', title: 'Study B', authors: 'B. Author', year: 2023, source: 'Journal', summary: '', doi: '', url: '' },
  { id: 'paper-private', project_id: 'project-2', title: 'Other project', authors: 'C. Author', year: 2022 },
];

function validDraft(sourceId = 'paper-a') {
  return { sections: LITERATURE_REVIEW_SECTIONS.map((section, index) => ({
    section_id: section.id,
    claims: index === 0 ? [{ heading: '', text: 'Supported background.', source_ids: [sourceId] }] : [],
  })) };
}

test('project source selection excludes records linked to another project', () => {
  assert.deepEqual(projectLinkedPapers(papers, 'project-1').map(paper => paper.id), ['paper-a', 'paper-b']);
});

test('review validation requires every section and only selected real source identifiers', () => {
  const checked = validateLiteratureReviewDraft(validDraft(), [papers[0]]);
  assert.equal(checked.length, LITERATURE_REVIEW_SECTIONS.length);
  assert.deepEqual(checked[0].claims[0].source_ids, ['paper-a']);
  assert.throws(() => validateLiteratureReviewDraft(validDraft('invented-id'), [papers[0]]), /not selected/);
  assert.throws(() => validateLiteratureReviewDraft({ sections: validDraft().sections.slice(1) }, [papers[0]]), /every required/);
  const extraProperty = validDraft();
  extraProperty.sections[0].claims[0].fabricated_doi = '10.9999/not-real';
  assert.throws(() => validateLiteratureReviewDraft(extraProperty, [papers[0]]), /text and linked sources/);
});

test('every factual claim must carry source provenance', () => {
  const draft = validDraft();
  draft.sections[0].claims[0].source_ids = [];
  assert.throws(() => validateLiteratureReviewDraft(draft, [papers[0]]), /include text and linked sources/);
});

test('EYRA prompt uses selected abstract metadata and limits review scope', () => {
  const prompt = buildLiteratureReviewPrompt({ question: 'Does intervention A improve outcome B?', searchScope: 'English, 2018–2025', papers: [papers[0]] });
  assert.match(prompt, /not be described as one/);
  assert.match(prompt, /English, 2018–2025/);
  assert.match(prompt, /Abstract A/);
  assert.match(prompt, /paper-a/);
  assert.doesNotMatch(prompt, /10\.1234\/test-a/);
});

test('bibliography is assembled from stored metadata, never EYRA output', () => {
  const bibliography = bibliographyForSelectedPapers(projectLinkedPapers(papers, 'project-1'), ['paper-a', 'paper-private']);
  assert.deepEqual(bibliography.map(source => source.id), ['paper-a']);
  assert.equal(bibliography[0].doi, '10.1234/test-a');
});

test('save receipt requires the exact returned project artifact', () => {
  const review = { research_question: 'Q', edited_sections: [] };
  assert.equal(hasLiteratureReviewSaveReceipt({ id: 'project-1', literature_review: review }, 'project-1', review), true);
  assert.equal(hasLiteratureReviewSaveReceipt({ id: 'project-2', literature_review: review }, 'project-1', review), false);
  assert.equal(hasLiteratureReviewSaveReceipt({ id: 'project-1', literature_review: { research_question: 'Q' } }, 'project-1', review), false);
});

test('Markdown export contains only known bibliography links and marks preliminary scope', () => {
  const sections = validateLiteratureReviewDraft(validDraft(), [papers[0]]);
  const markdown = exportLiteratureReviewMarkdown({ question: 'Question', searchScope: 'Specified search', sections, bibliography: bibliographyForSelectedPapers(papers, ['paper-a']) });
  assert.match(markdown, /not a systematic review/i);
  assert.match(markdown, /Study A/);
  assert.match(markdown, /https:\/\/example\.org\/a/);
  assert.doesNotMatch(markdown, /javascript:/i);
});
