import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('getting started is public and independent of AI and sign-in',()=>{
 const app=source('App.jsx'),start=source('pages/GettingStarted.jsx');
 assert.match(app,/path="\/start" element=\{<GettingStarted \/>}/);
 assert.match(start,/You do not need research or technical experience/);
 for(const route of ['/search','/academics','/careers','/projects','/library','/contact']) {
   assert.ok(start.includes("path:'"+route+"'") || start.includes('to="'+route+'"'),route);
 }
 assert.match(start,/No account needed to search/);
 assert.match(start,/Sign-in required for private work/);
 assert.match(start,/What if EYRA AI is unavailable/);
 assert.match(start,/aria-labelledby="start-title"/);
});
test('every visitor can find the guide in the homepage, menu and 404',()=>{
 const landing=source('pages/Landing.jsx'),notFound=source('lib/PageNotFound.jsx');
 assert.match(landing,/<Link to="\/start">Start here<\/Link>/);
 assert.match(landing,/Start here — simple guide/);
 assert.match(landing,/path: '\/search', action: 'Try public research search'/);
 assert.match(landing,/path: '\/library', action: 'Open my Library'/);
 assert.match(landing,/path: '\/projects', action: 'Open my projects'/);
 assert.match(notFound,/to="\/start"/);
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
 assert.match(landing,/Explore research <ArrowUpRight/);
 assert.match(landing,/to="\/discover"/);
});
