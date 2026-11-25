import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bibliographyForProposal,
  buildResearchProposalPrompt,
  exportResearchProposalMarkdown,
  hasProposalSaveReceipt,
  METHODOLOGY_TOPICS,
  PROPOSAL_CLAIM_KINDS,
  PROPOSAL_SECTIONS,
  projectLinkedProposalPapers,
  proposalErrorMessage,
  RESEARCH_PROPOSAL_SCHEMA,
  stableProposalStringify,
  validateResearchProposalDraft,
} from '../src/lib/research-proposal-studio.mjs';

const papers = [
  { id: 'paper-a', project_id: 'project-1', title: 'Study A', authors: 'A. Author', year: 2024, source: 'Journal', summary: 'Abstract A', doi: '10.1234/test-a', url: 'https://doi.org/10.1234/test-a' },
  { id: 'paper-b', project_id: 'project-1', title: 'Study B', authors: 'B. Author', year: 2023, source: 'Journal', summary: 'Abstract B', url: 'https://example.org/b' },
  { id: 'private-paper', project_id: 'project-2', title: 'Other project source', authors: 'C. Author', year: 2022 },
];

function validProposal(sourceId = 'paper-a') {
  return {
    sections: PROPOSAL_SECTIONS.map(section => ({
      section_id: section.id,
      status: section.id === 'hypotheses' ? 'not_applicable' : section.id === 'data_analysis_plan' ? 'needs_input' : 'drafted',
      claims: section.id === 'background' ? [{ heading: 'Available evidence', text: 'The selected abstract reports the study topic.', kind: 'source_fact', source_ids: [sourceId] }]
        : section.id === 'research_title' ? [{ heading: 'Working title', text: 'A proposed study of the selected question.', kind: 'proposal', source_ids: [] }]
          : [],
    })),
    methodology_plan: Object.fromEntries(METHODOLOGY_TOPICS.map(topic => [topic.id, { status: 'needs_input', claims: [] }])),
  };
}

test('proposal authorization includes only papers linked to the current project', () => {
  assert.deepEqual(projectLinkedProposalPapers(papers, 'project-1').map(paper => paper.id), ['paper-a', 'paper-b']);
});

test('proposal schema requires all sections, methodology topics and typed, traceable claims', () => {
  assert.deepEqual(RESEARCH_PROPOSAL_SCHEMA.required, ['sections', 'methodology_plan']);
  assert.equal(PROPOSAL_SECTIONS.length, 18);
  assert.equal(Object.keys(RESEARCH_PROPOSAL_SCHEMA.properties.methodology_plan.properties).length, METHODOLOGY_TOPICS.length);
  assert.deepEqual(PROPOSAL_CLAIM_KINDS, ['source_fact', 'interpretation', 'proposal', 'open_question']);
  const checked = validateResearchProposalDraft(validProposal(), [papers[0]]);
  assert.equal(checked.sections.length, 18);
  assert.deepEqual(Object.keys(checked.methodology_plan), METHODOLOGY_TOPICS.map(topic => topic.id));
});

test('unknown, unselected and cross-project source identifiers fail closed', () => {
  assert.throws(() => validateResearchProposalDraft(validProposal('invented-paper'), [papers[0]]), /not selected/);
  assert.throws(() => validateResearchProposalDraft(validProposal('paper-b'), [papers[0]]), /not selected/);
  assert.deepEqual(bibliographyForProposal(projectLinkedProposalPapers(papers, 'project-1'), ['paper-a', 'private-paper']).map(source => source.id), ['paper-a']);
});

test('source facts and interpretations cannot omit citations and bibliography cannot be AI-authored', () => {
  const uncited = validProposal();
  uncited.sections.find(section => section.section_id === 'background').claims[0].source_ids = [];
  assert.throws(() => validateResearchProposalDraft(uncited, [papers[0]]), /without a citation/);
  const inventedReference = validProposal();
  inventedReference.sections.find(section => section.section_id === 'bibliography').claims.push({ heading: 'Citation', text: 'Invented reference', kind: 'source_fact', source_ids: ['paper-a'] });
  assert.throws(() => validateResearchProposalDraft(inventedReference, [papers[0]]), /must not create bibliography/);
});

test('incomplete sections and invalid applicability combinations are rejected', () => {
  const missing = validProposal(); missing.sections.pop();
  assert.throws(() => validateResearchProposalDraft(missing, [papers[0]]), /omitted a required/);
  const contradictory = validProposal();
  contradictory.sections.find(section => section.section_id === 'background').status = 'not_applicable';
  assert.throws(() => validateResearchProposalDraft(contradictory, [papers[0]]), /inapplicable proposal section/);
  const missingMethod = validProposal(); delete missingMethod.methodology_plan.reproducibility;
  assert.throws(() => validateResearchProposalDraft(missingMethod, [papers[0]]), /incomplete proposal structure/);
});

test('prompt sends only explicitly selected project outputs and available abstracts', () => {
  const prompt = buildResearchProposalPrompt({
    question: 'Does intervention A improve outcome B?', researchType: 'quantitative', papers: [papers[0]],
    project: { id: 'project-1', title: 'Project', goal: 'Measure outcome B', description: 'Authorized project context', private_note: 'Must not be sent' },
    evidenceMatrix: { research_question: 'Question from matrix', ai_draft: { rows: [{ paper_id: 'paper-a', findings: 'Selected finding' }, { paper_id: 'paper-b', findings: 'Unselected row' }] }, annotations: { 'paper-a': { findings: 'Researcher note' } } },
    literatureReview: { research_question: 'Question from review', edited_sections: [{ section_id: 'background', claims: [{ text: 'Reviewed evidence', source_ids: ['paper-a'] }] }] },
    contextSelection: { project_objectives: true, evidence_matrix: true, literature_review: false, researcher_notes: true },
  });
  assert.match(prompt, /Measure outcome B/);
  assert.match(prompt, /Question from matrix/);
  assert.match(prompt, /Selected finding/);
  assert.match(prompt, /Researcher note/);
  assert.doesNotMatch(prompt, /Question from review/);
  assert.doesNotMatch(prompt, /Unselected row/);
  assert.doesNotMatch(prompt, /Must not be sent/);
  assert.match(prompt, /never a completed or approved study/);
  assert.match(prompt, /bibliography section and its claims must always be empty/);
});

test('save receipt compares the complete private project artifact independent of key order', () => {
  const proposal = { research_question: 'Question', edited_sections: [], updated_at: 'now' };
  const reordered = { updated_at: 'now', edited_sections: [], research_question: 'Question' };
  assert.equal(hasProposalSaveReceipt({ id: 'project-1', research_proposal: reordered }, 'project-1', proposal), true);
  assert.equal(hasProposalSaveReceipt({ id: 'project-2', research_proposal: proposal }, 'project-1', proposal), false);
  assert.notEqual(stableProposalStringify({ a: 1, b: 2 }), stableProposalStringify({ a: 1, b: 3 }));
});

test('provider failures and cancellation are mapped to safe actionable messages', () => {
  assert.match(proposalErrorMessage({ status: 429, retryAfterSeconds: 10 }), /10 seconds/);
  assert.match(proposalErrorMessage({ status: 504 }), /timed out/);
  assert.match(proposalErrorMessage({ name: 'AbortError' }), /cancelled/);
  assert.doesNotMatch(proposalErrorMessage(new Error('provider secret token')), /secret token/);
});

test('Markdown export retains real selected citations, labels proposed methods and excludes invented sources', () => {
  const checked = validateResearchProposalDraft(validProposal(), [papers[0]]);
  const bibliography = bibliographyForProposal(papers, ['paper-a']);
  const markdown = exportResearchProposalMarkdown({
    question: 'Question', researchType: 'quantitative', sections: checked.sections,
    methodologyPlan: checked.methodology_plan, bibliography,
  });
  assert.match(markdown, /A proposed study/);
  assert.match(markdown, /Source fact · EYRA draft/);
  assert.match(markdown, /10\.1234\/test-a/);
  assert.match(markdown, /editable scientific draft/i);
  assert.doesNotMatch(markdown, /Other project source/);
  assert.doesNotMatch(markdown, /javascript:/i);
});
