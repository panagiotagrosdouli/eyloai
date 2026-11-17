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
  assert.match(crumbs,/ownerRef\.current !== owner/);
  assert.match(crumbs,/aria-label="Breadcrumb"/);
  assert.match(home,/New to EYLO\? Start here\./);
  assert.match(home,/aria-label="Common starting actions"/);
  assert.match(home,/More things you can do/);
  assert.match(home,/Browse all tools/);
  assert.match(layout,/See every feature and what it does/);
  assert.match(layout,/item\.desc &&/);
});
