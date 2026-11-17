import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEyraCommandEvidence, buildEyraCommandPrompt, EYRA_COMMAND_PROMPT_BUDGET } from '../src/lib/eyra-command-evidence.mjs';
import { checkEyraCitationIds } from '../src/lib/eyra-citation-ids.mjs';

function group(items, status) { return { items, ...(status ? { status } : {}) }; }
function paper(i) {
  return {
    title: 'Paper ' + i + ' ' + 'T'.repeat(5000),
    doi: '10.5555/' + i,
    source: 'OpenAlex', year: 2026, authors: 'Researchers ' + 'A'.repeat(2500),
    summary: 'Long research abstract ' + 'S'.repeat(15000),
    url: 'https://openalex.org/W' + (i + 100),
  };
}

test('unsafe provider links are excluded before source IDs are assigned', () => {
  const packet = buildEyraCommandEvidence({
    papers: group([
      { title: 'Unsafe first record', url: 'javascript:alert(1)' },
      paper(1),
      { title: 'Credentials', url: 'https://admin:secret@publisher.example/paper' },
      paper(2),
    ]),
    funding: group([{ title: 'Valid official call', source: 'Grants.gov',
      source_url: 'https://www.grants.gov/search-results-detail/1234' }]),
  });
  assert.deepEqual(packet.sources.map(s => s.id), ['P1', 'P2', 'F1']);
  assert.ok(packet.blocks.some(block => block.startsWith('[P1] PAPER | Paper 1')));
  assert.ok(packet.blocks.some(block => block.startsWith('[P2] PAPER | Paper 2')));
  assert.ok(packet.blocks.some(block => block.startsWith('[F1] FUNDING | Valid official call')));
  assert.doesNotMatch(packet.blocks.join(' '), /Unsafe first|admin:secret|javascript:/i);
  assert.equal(checkEyraCitationIds('Discuss [P1], [P2] and [F1].', packet.sources).valid, true);
  assert.equal(checkEyraCitationIds('Unsupported [P3].', packet.sources).valid, false);
});

test('large abstracts, institutional metadata and funding descriptions cannot overflow evidence budget', () => {
  const packet = buildEyraCommandEvidence({
    papers: group(Array.from({ length: 30 }, (_, i) => paper(i))),
    researchers: group(Array.from({ length: 10 }, (_, i) => ({
      name: 'Researcher ' + i, profile_url: 'https://openalex.org/A' + (i + 1),
      institution: 'University ' + 'X'.repeat(15000), research_areas: 'Y'.repeat(9000),
    }))),
    institutions: group(Array.from({ length: 9 }, (_, i) => ({
      name: 'Institution ' + i, url: 'https://openalex.org/I' + (i + 1),
      country: 'GR', works_count: 100,
    }))),
    funding: group(Array.from({ length: 14 }, (_, i) => ({
      title: 'Official listing ' + i, source_url: 'https://www.grants.gov/search-results-detail/' + (i + 1),
      amount: '$' + '9'.repeat(9000), description: 'D'.repeat(9000),
      eligibility: 'E'.repeat(9000), deadline: '2026-12-31',
    }))),
  }, 2);
  assert.ok(packet.blocks.join('\n').length < 8_100);
  assert.ok(packet.sources.length > 8);
  assert.ok(packet.sources.length <= 26);
  assert.ok(packet.blocks.some(block => block.startsWith('SOURCE STATUS | 2 provider retrieval task(s) unavailable')));
  for (const source of packet.sources) {
    assert.ok(packet.blocks.some(block => block.startsWith('[' + source.id + '] ')),
      'never display a citation without its indexed model source: ' + source.id);
  }
  for (const prefix of ['P', 'R', 'I', 'F']) {
    const ids = packet.sources.filter(s => s.id.startsWith(prefix));
    assert.deepEqual(ids.map(s => s.id), ids.map((_, index) => prefix + (index + 1)));
  }
});

test('status failures are transparent without exposing upstream private error messages', () => {
  const packet = buildEyraCommandEvidence({
    papers: group([], [
      { label: 'OpenAlex', status: 'unavailable', error: 'PRIVATE_OPENAI_TOKEN' },
      { label: 'arXiv', status: 'available' },
    ]),
  }, 1);
  assert.equal(packet.sources.length, 0);
  assert.match(packet.blocks.join('\n'), /OpenAlex unavailable/);
  assert.match(packet.blocks.join('\n'), /1 provider retrieval task/);
  assert.doesNotMatch(packet.blocks.join('\n'), /PRIVATE_OPENAI_TOKEN/);
});

test('source-linked prompt preserves full user question while bounding all surrounding context', () => {
  const question = 'Please compare methods ' + 'Q'.repeat(1700);
  const prompt = buildEyraCommandPrompt({
    baseSystem: 'NON-NEGOTIABLE RULES:\n- Cite record IDs\n- No invented facts',
    modePrompt: 'Evidence review:\n- Assess uncertainty',
    language: 'Greek', style: 'Research-grade scientific method',
    personalized: true, workspaceContext: 'Private workspace ' + 'W'.repeat(20000),
    query: 'topic', evidenceBlocks: buildEyraCommandEvidence({
      papers: group(Array.from({ length: 8 }, (_, i) => paper(i))),
    }).blocks,
    history: 'Previous discussion ' + 'H'.repeat(20000),
    userRequest: question,
  });
  assert.ok(prompt.length <= EYRA_COMMAND_PROMPT_BUDGET);
  assert.ok(prompt.includes(question), 'do not truncate the latest user input');
  assert.match(prompt, /NON-NEGOTIABLE RULES:\n- Cite record IDs/);
  assert.match(prompt, /\[P1\]/);
  assert.ok(prompt.includes('Context excerpts are bounded'));
  assert.ok(prompt.includes('Workspace context'));
});

test('disabling personalization excludes saved workspace even when it is supplied', () => {
  const prompt = buildEyraCommandPrompt({
    baseSystem: 'Research rules', modePrompt: 'Academic',
    language: 'Greek', style: 'Detailed',
    personalized: false, workspaceContext: 'VERY_PRIVATE_RESEARCH_CONTEXT',
    query: 'physics', evidenceBlocks: [],
    history: '', userRequest: 'What is a controlled experiment?',
  });
  assert.doesNotMatch(prompt, /VERY_PRIVATE_RESEARCH_CONTEXT/);
  assert.match(prompt, /Personalization is disabled/);
  assert.match(prompt, /No retrieved records/);
  assert.throws(() => buildEyraCommandPrompt({
    baseSystem: '', modePrompt: '', userRequest: 'Q'.repeat(2001),
  }), /at most 2,000/);
});

test('the Command Center propagates cancellation to each source and keeps audited response guards', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.match(ui, /async function retrieveEvidence\(content, mode, workspaceContext, signal\)/);
  assert.match(ui, /searchAllPapersWithStatus\(query, \{ limit: 16, signal \}\)/);
  assert.match(ui, /searchOpenAlexAuthors\(query, 6, \{ throwOnError: true, signal \}\)/);
  assert.match(ui, /searchOpenAlexInstitutions\(query, 4, \{ throwOnError: true, signal \}\)/);
  assert.match(ui, /searchFundingOpportunities\(query, 10, \{ signal \}\)/);
  assert.match(ui, /signal\?\.throwIfAborted\(\)/);
  assert.match(ui, /buildEyraCommandEvidence\(groups, failedCount\)/);
  assert.match(ui, /buildEyraCommandPrompt\(\{/);
  assert.match(ui, /controller\.signal,/);
  assert.match(ui, /checkEyraCitationIds\(baseAnswer, evidence\.sources\)/);
  assert.match(ui, /buildEvidenceOnlyFallback\(evidence, error\)/);
  assert.match(ui, /if \(controller\.signal\.aborted\) return/);
});
