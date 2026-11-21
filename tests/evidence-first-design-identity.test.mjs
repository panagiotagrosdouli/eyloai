import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('EYLO landing presents an all-purpose entry and keeps evidence traceability', () => {
  const landing = read('pages/Landing.jsx');
  assert.match(landing, /One place to ask, learn/);
  assert.match(landing, /Your next step/);
  assert.match(landing, /source-linked research|scholarly records/i);
  assert.match(landing, /to="\/start"/);
  assert.match(landing, /to="\/discover"/);
  assert.doesNotMatch(landing, /guaranteed correct answers/i);
});

test('marketing walkthrough presents EYLO features without unnecessary labels',()=>{
  const preview=read('components/marketing/LandingPreview.jsx');
  assert.match(preview,/aria-label="EYLO interactive walkthrough"/);
  assert.doesNotMatch(preview,/EXAMPLE · RESEARCH TRAIL/);
  assert.doesNotMatch(preview,/Example screens and sample content — not live research results or an AI answer/);
  assert.doesNotMatch(preview,/<figcaption/);
  assert.match(preview,/label: "Discover"/);
  assert.match(preview,/label: "Workspace"/);
  assert.match(preview,/label: "EYRA"/);
  assert.match(preview,/bg-\[var\(--company-surface\)\] text-\[var\(--company-ink\)\] shadow-sm/);
});

test('getting started keeps the same public brand palette in both themes',()=>{
  const guide=read('pages/GettingStarted.jsx');
  assert.match(guide,/import '\.\/landing\.css'/);
  assert.match(guide,/eylo-company min-h-screen bg-\[var\(--company-surface\)\]/);
  assert.match(guide,/border-\[var\(--company-border\)\]/);
  assert.match(guide,/text-\[var\(--company-muted\)\]/);
  assert.doesNotMatch(guide,/\bbg-background\b|\btext-muted-foreground\b/);
  assert.match(guide,/public academic records without signing in/i);
});

test('EYRA-first Home preserves evidence as a separate, verifiable workflow', () => {
  const home = read('components/dashboard/EyraHome.jsx');
  assert.match(home, /What can EYLO help you do today/);
  assert.match(home, /Research sources/);
  assert.match(home, /AI answers may be inaccurate/);
  assert.match(home, /eylo:open-eyra/);
  assert.doesNotMatch(home, /Search verified research sources/);
});
