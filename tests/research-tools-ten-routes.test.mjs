import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const app = read('App.jsx');

const tools = [
  ['Challenges', '/challenges', 'open-challenges'],
  ['ExecutiveBriefing', '/briefing', 'executive-briefing'],
  ['OpportunityRadar', '/radar', 'opportunity-review'],
  ['ResearchBattlefield', '/labs/research-landscape', 'research-landscape'],
  ['ImpactPredictor', '/labs/impact', 'impact-review'],
  ['FutureSimulator', '/labs/scenario', 'scenario-planner'],
  ['DreamTeam', '/labs/team', 'team-planner'],
  ['VoiceAssistant', '/labs/voice', 'voice-workspace'],
  ['GrantBuilder', '/grant-builder', 'grant-workspace'],
  ['PitchDeckBuilder', '/pitchdeck', 'pitch-deck'],
];

test('all ten product entries have a real protected route, research action and explicit export', () => {
  for (const [component, route, toolName] of tools) {
    assert.ok(app.includes('path="' + route + '"'), 'missing protected route ' + route);
    const source = read('pages/' + component + '.jsx');
    assert.match(source, /downloadResearchReport\(/, component + ' missing export action');
    assert.ok(source.includes("tool: '" + toolName + "'"), component + ' export provenance identity');
    assert.ok(source.includes('loading') || source.includes('running'), component + ' lacks action state');
    assert.ok(source.includes('base44') || source.includes('searchFundingOpportunities') || source.includes('runEyraDiscovery'), component + ' lacks actual provider/data flow');
  }
});

test('private briefing does not read or write an unscoped localStorage key', () => {
  const source = read('pages/ExecutiveBriefing.jsx');
  assert.doesNotMatch(source, /localStorage\.(getItem|setItem)\(/);
  assert.match(source, /readPrivateResearchCache\(sessionStorage, 'executive-briefing', me\.id\)/);
  assert.match(source, /writePrivateResearchCache\(sessionStorage, 'executive-briefing', currentUser\.id/);
});

test('Radar saves only after a canonical owner-scoped duplicate check and reports failures', () => {
  const source = read('pages/OpportunityRadar.jsx');
  assert.match(source, /pendingSaves\.current\.has\(key\)/);
  assert.match(source, /SavedOpportunity\.list/);
  assert.match(source, /SavedOpportunity\.create/);
  assert.match(source, /Could not save opportunity/);
  assert.match(source, /disabled=\{savingKeys\.has/);
});

test('grant and pitch exports remain honest about status and retain source links', () => {
  const grant = read('pages/GrantBuilder.jsx');
  const pitch = read('pages/PitchDeckBuilder.jsx');
  assert.match(grant, /saveProjectGrantApplication\(/);
  assert.match(grant, /Export structured draft/);
  assert.match(grant, /Export draft/);
  assert.match(pitch, /pdf\.save\('eylo-pitch-deck\.pdf'\)/);
  assert.match(pitch, /References · retrieved records/);
  assert.doesNotMatch(pitch, /localStorage\.setItem\('eyra_pitch_deck_latest_v2'/);
});
