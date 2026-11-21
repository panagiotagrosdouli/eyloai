import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('getting started is public and offers different goals', () => {
  const app = source('App.jsx'), start = source('pages/GettingStarted.jsx');
  assert.match(app, /path="\/start" element=\{<GettingStarted \/>}/);
  assert.match(start, /AI assistance, learning, creation, planning and research/);
  for (const route of ['/search', '/academics', '/projects', '/library', '/company', '/learn', '/documents/new']) {
    assert.ok(start.includes("path:'" + route + "'") || start.includes('to="' + route + '"'), route);
  }
  assert.match(start, /public academic records without signing in/i);
  assert.match(start, /What if EYRA AI is unavailable/);
  assert.match(start, /aria-labelledby="start-title"/);
});

test('homepage and error routes provide a beginner-friendly starting point', () => {
  const landing = source('pages/Landing.jsx'), notFound = source('lib/PageNotFound.jsx');
  assert.match(landing, /to="\/start"/);
  assert.match(landing, /Help me choose/);
  assert.match(notFound, /to="\/start"/);
});

test('page crashes offer a safe public guide rather than trapping a beginner',()=>{
 const boundary=source('components/system/RouteErrorBoundary.jsx');
 assert.match(boundary,/to="\/start"/);
 assert.match(boundary,/Not sure where to go\? Start here/);
 assert.match(boundary,/hasError: false/);
});

test('public entry does not promise AI before its provider succeeds',()=>{
 const landing=source('pages/Landing.jsx');
 assert.doesNotMatch(landing,/Enter EYLO AI/);
 assert.match(landing,/Explore EYLO/);
 assert.match(landing,/to="\/discover"/);
});

test('first-time guidance does not direct users to disabled contact delivery',()=>{
  const guide=source('pages/GettingStarted.jsx');
  assert.match(guide,/to="\/company"/);
  assert.match(guide,/Learn more about EYLO/);
  assert.doesNotMatch(guide,/Contact EYLO for help/);
});
