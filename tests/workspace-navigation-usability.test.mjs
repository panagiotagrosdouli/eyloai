import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWorkspaceNavigation, advanceWorkspaceTrail, isSafeWorkspaceHref } from '../src/lib/navigation/workspace-navigation.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
test('a project deep link shows a friendly path and a stable parent',()=>{
  const detail=getWorkspaceNavigation('/projects/'+id);
  assert.deepEqual(detail.crumbs.map(c=>c.label),['My workspace','Project']);
  assert.equal(detail.backPath,'/projects');
  const thesis=getWorkspaceNavigation('/projects/'+id+'/thesis');
  assert.deepEqual(thesis.crumbs.map(c=>c.label),['My workspace','Project','Thesis studio']);
  assert.equal(thesis.crumbs[1].path,'/projects/'+id);
  assert.equal(thesis.backPath,'/projects/'+id);
  assert.doesNotMatch(thesis.crumbs.map(c=>c.label).join('/'),new RegExp(id));
});
test('a direct route always has a beginner-friendly return',()=>{
  assert.equal(getWorkspaceNavigation('/library').backPath,'/projects');
  assert.equal(getWorkspaceNavigation('/life/goals').backPath,'/life');
  assert.equal(getWorkspaceNavigation('/tools/skills').backPath,'/tools');
  assert.equal(getWorkspaceNavigation('/labs/data').crumbs.at(-1).label,'Research Data Lab');
  assert.equal(getWorkspaceNavigation('/workspace/careers').backPath,'/search');
  assert.equal(getWorkspaceNavigation('/documents/'+id).crumbs.at(-1).label,'Edit document');
  assert.equal(getWorkspaceNavigation('/unknown').backPath,'/home');
  assert.equal(getWorkspaceNavigation('/home').visible,false);
});
test('in-app Back history collapses when returning to an earlier page',()=>{
  let trail=[];
  for(const href of ['/home','/search?q=climate','/projects','/projects/'+id]){
    trail=advanceWorkspaceTrail(trail,href);
  }
  assert.equal(trail.at(-2),'/projects');
  trail=advanceWorkspaceTrail(trail,'/projects');
  assert.deepEqual(trail,['/home','/search?q=climate','/projects']);
  assert.deepEqual(advanceWorkspaceTrail(trail,'/projects'),trail);
});
test('history refuses external and unsafe paths, and stays bounded',()=>{
  for(const url of ['https://example.com','//evil.com','/\\evil','/hello\nworld','']){
    assert.equal(isSafeWorkspaceHref(url),false);
    assert.deepEqual(advanceWorkspaceTrail(['/home'],url),['/home']);
  }
  let trail=[];
  for(let i=0;i<30;i++)trail=advanceWorkspaceTrail(trail,'/tools/item-'+i);
  assert.equal(trail.length,12);
  assert.equal(trail.at(-1),'/tools/item-29');
});
test('beginner guidance, Back and tool explanations are accessible',()=>{
  const crumbs=readFileSync(new URL('../src/components/layout/WorkspaceBreadcrumbs.jsx',import.meta.url),'utf8');
  const home=readFileSync(new URL('../src/components/dashboard/EyraHome.jsx',import.meta.url),'utf8');
  const layout=readFileSync(new URL('../src/components/layout/AppLayout.jsx',import.meta.url),'utf8');
  assert.match(crumbs,/Back to previous EYLO page/);
  const provider=readFileSync(new URL('../src/components/layout/WorkspaceNavigationProvider.jsx',import.meta.url),'utf8');
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(provider,/const owner = user\?\.id \?\? null/);
  assert.match(provider,/state\.owner === owner && state\.trail\.at\(-1\) === href/);
  assert.match(provider,/advanceWorkspaceTrail\(trail, href\)/);
  assert.match(app,/<WorkspaceNavigationProvider>/);
  assert.match(crumbs,/useWorkspacePreviousHref\(\)/);
  assert.match(crumbs,/aria-label="Breadcrumb"/);
  assert.match(home,/New to EYLO\? Start here\./);
  assert.match(home,/aria-label="Common starting actions"/);
  assert.match(home,/More things you can do/);
  assert.match(home,/Browse all tools/);
  assert.match(layout,/See every feature and what it does/);
  assert.match(layout,/item\.desc &&/);
});

test('the Back provider spans public Discover and signed-in workspace pages',()=>{
  const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  const open=app.indexOf('<WorkspaceNavigationProvider>');
  const search=app.indexOf('<Route path="/search"');
  const privateRoutes=app.indexOf('<Route path="/*"');
  const close=app.indexOf('</WorkspaceNavigationProvider>');
  assert.ok(open >= 0 && open < search && search < privateRoutes && privateRoutes < close);
});

test('Back never returns to a sign-in, recovery, callback or deletion form',()=>{
  for(const path of ['/login?from=%2Fprojects','/register','/forgot-password','/reset-password','/auth/callback?code=fixture','/account-deletion']){
    assert.deepEqual(advanceWorkspaceTrail(['/home'],path),['/home']);
  }
});

test('mobile Back never prints raw or noncanonical project identifiers',()=>{
  const opaque='10000000-0000-0000-0000-000000000001';
  const entry=getWorkspaceNavigation('/projects/'+opaque+'/research/journal');
  assert.equal(entry.backPath,'/projects/'+opaque);
  assert.equal(entry.backLabel,'Project');
  assert.doesNotMatch(entry.backLabel,/10000000/);
  const ordinary=getWorkspaceNavigation('/projects/123e4567-e89b-42d3-a456-426614174000/thesis');
  assert.equal(ordinary.backLabel,'Project');
});

test('nested research workspaces have exact, plain-language names',()=>{
 const project='10000000-0000-0000-0000-000000000001';
 const cases=[
   ['/research/journal','Research Journal'],
   ['/research/experiments','Experiment Lab'],
   ['/research/publications','Publication Tracker'],
   ['/research/unrecognized','Research records']
 ];
 for(const [suffix,title] of cases){
   const page=getWorkspaceNavigation('/projects/'+project+suffix);
   assert.equal(page.backPath,'/projects/'+project);
   assert.equal(page.backLabel,'Project');
   assert.equal(page.crumbs.at(-1).label,title);
   assert.equal(page.crumbs[1].path,'/projects/'+project);
   assert.doesNotMatch(page.crumbs.map(c=>c.label).join(' / '),/10000000/);
 }
});
