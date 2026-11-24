import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('EYLO has a recognisable research trail rather than an AI-only promise', () => {
  const landing = read('pages/Landing.jsx');
  assert.match(landing,/RESEARCH · AI · PROJECTS/);
  assert.match(landing,/Your research,/);
  assert.match(landing,/all in one place/);
  assert.match(landing,/Find papers, think through questions with EYRA/);
  assert.match(landing,/Explore research <ArrowRight/);
  assert.doesNotMatch(landing,/A better way to\s*\n\s*<br \/>/);
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
  assert.match(guide,/try public search before signing in/);
});

test('research Home does not call unverified indexed records verified',()=>{
  const home=read('components/dashboard/EyraHome.jsx');
  assert.doesNotMatch(home,/Search verified research sources/);
  assert.match(home,/Explore source-linked academic records/);
  assert.match(home,/Always check the original papers/);
  assert.match(home,/EYRA can help with follow-up questions when available/);
});
