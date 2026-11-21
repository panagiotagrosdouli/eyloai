import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWorkspaceNavigation } from '../src/lib/navigation/workspace-navigation.mjs';
const read = p => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('one router contains both the public guide and account-safe Back provider', () => {
 const app=read('App.jsx');
 const open=app.indexOf('<WorkspaceNavigationProvider>');
 const guide=app.indexOf('path="/start" element={<GettingStarted />} />');
 const discover=app.indexOf('path="/search"');
 const protectedEntry=app.indexOf('path="/*"');
 const close=app.indexOf('</WorkspaceNavigationProvider>');
 assert.ok(open>=0 && open<guide && guide<close);
 assert.ok(open<discover && discover<close && open<protectedEntry && protectedEntry<close);
 assert.equal(app.split('path="/start"').length-1,1);
});

test('beginners can explore without login and return to human-readable project sections',()=>{
 const guide=read('pages/GettingStarted.jsx');
 assert.match(guide,/public academic records without signing in/i);
 assert.match(guide,/some features require an account/i);
 const research=getWorkspaceNavigation('/projects/10000000-0000-0000-0000-000000000001/research/journal');
 assert.equal(research.backLabel,'Project');
 assert.equal(research.crumbs.at(-1).label,'Research Journal');
 const crumbs=read('components/layout/WorkspaceBreadcrumbs.jsx');
 assert.match(crumbs,/useWorkspacePreviousHref/);
});

test('one E2E scenario protects both onboarding and mobile research record overflow',()=>{
 const fixture=readFileSync(new URL('./e2e-learning-integration.mjs',import.meta.url),'utf8');
 assert.match(fixture,/public first-use guide opens on mobile/);
 assert.ok(fixture.includes('Mobile overflow diagnostics (fixture only)'));
});
