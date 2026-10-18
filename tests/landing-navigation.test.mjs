import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../src/pages/Landing.jsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('original EYLO homepage retains its primary navigation and linked routes', () => {
  assert.match(landing, /to="\/" aria-label="EYLO home"/);
  assert.match(landing, /to="\/login"/);
  assert.match(landing, /to=\{PROJECT_SIGNUP_HREF\}/);
  assert.match(landing, /href="#careers"/);
  assert.match(landing, /to="\/discover"/);
  assert.match(routes, /path="\/login"/);
  assert.match(routes, /path="\/register"/);
  assert.match(routes, /path="\/discover"/);
});

test('Careers retains original email-contact behavior', () => {
  assert.match(landing, /id="careers"/);
  assert.match(landing, /href="mailto:[^"]+subject=EYLO%20Careers/);
  assert.match(landing, /Express interest by email/);
});

test('small-screen header uses compact navigation but restores original desktop sizes', () => {
  assert.match(landing, /gap-1 px-3 sm:gap-3 sm:px-8/);
  assert.match(landing, /sm:px-3 sm:text-sm">Careers/);
  assert.match(landing, /sm:px-3 sm:text-sm">Sign in/);
  assert.match(landing, /sm:px-4 sm:text-sm">Get started/);
  assert.match(landing, /sm:!h-14 sm:!w-\[5\.25rem\]/);
});

test('landing search preserves query encoding and public discover flow', () => {
  assert.match(landing, /encodeURIComponent\(query\)/);
  assert.match(landing, /navigate\(query \? `\/discover\?q=/);
  assert.match(landing, /id="research-question"/);
});
