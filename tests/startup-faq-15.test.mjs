import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EYLO_STARTUP_QUESTIONS, EYLO_ACCOUNT_QUESTION } from '../src/lib/eylo-startup-questions.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('startup launch provides exactly 15 distinct, plain-language questions with real answers', () => {
  assert.equal(EYLO_STARTUP_QUESTIONS.length, 15);
  assert.equal(new Set(EYLO_STARTUP_QUESTIONS.map(entry => entry.question)).size, 15);
  for (const entry of EYLO_STARTUP_QUESTIONS) {
    assert.ok(entry.question.endsWith('?'));
    assert.ok(entry.answer.length >= 90);
    assert.doesNotMatch(entry.answer, /guaranteed funding|verified ROI|thousands of users/i);
  }
  assert.match(EYLO_ACCOUNT_QUESTION.question, /before creating an account/i);
});

test('concise EYLO homepage explains its product and keeps clear navigation', () => {
  const landing = read('src/pages/Landing.jsx');
  assert.match(landing, /LandingPreview/);
  assert.match(landing, /Your research,/);
  assert.match(landing, /Find papers, think through questions with EYRA/);
  assert.match(landing, /href="#how-it-works"/);
  assert.match(landing, /href="#why-eylo"/);
  assert.match(landing, /href="#who-its-for"/);
  assert.match(landing, /<Link to="\\/start">Start here<\\/Link>/);
  assert.match(landing, /brand\\/eylo-light\\.svg/);
  assert.match(landing, /aria-label="Company navigation"/);
  assert.match(landing, /aria-label="Mobile navigation"/);
  assert.doesNotMatch(landing, /PublicPlans|questions\\.map/);
});

test('EYRA product explanations avoid unsupported claims about startup readiness', () => {
  const server = read('server/eyra-system-instructions.mjs');
  const client = read('src/lib/eyra-next-policy.mjs');
  for (const source of [server, client]) {
    assert.match(source, /ChatGPT/);
    assert.match(source, /Grants\.gov/);
    assert.match(source, /original/);
    assert.match(source, /support SLAs/);
    assert.match(source, /five-minute demo/);
  }
});
