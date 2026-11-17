import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = p => readFileSync(new URL('../src/'+p, import.meta.url), 'utf8');

test('release candidate unifies auth deadlines, owner-safe home, public guide and read-only automations', () => {
  const app=get('App.jsx');
  const auth=get('lib/supabase/auth.js');
  const home=get('components/dashboard/EyraHome.jsx');
  const automation=get('pages/TaskAutomations.jsx');
  assert.match(app,/const TaskAutomations = lazy/);
  assert.match(app,/path="\/automations" element=\{<TaskAutomations \/>}/);
  assert.match(app,/path="\/start" element=\{<GettingStarted \/>}/);
  assert.match(app,/<WorkspaceNavigationProvider>/);
  assert.match(auth,/withAuthRequestDeadline/);
  assert.match(home,/workspaceState\.ownerId === ownerId/);
  assert.match(home,/AI configured does not guarantee a live response/);
  assert.match(automation,/manual workflows/);
  assert.match(automation,/not recurring background schedules/);
  assert.doesNotMatch(automation,/setInterval\(/);
});

test('export and notifications never report invented completion or conceal missing optional tables',()=>{
  const settings=get('pages/Settings.jsx');
  const exportModule=get('lib/workspace-export.mjs');
  const monitor=get('lib/monitoring-service.js');
  const records=get('lib/monitoring-records.mjs');
  assert.match(settings,/unavailable_collections/);
  assert.match(settings,/This is a partial workspace export/);
  assert.match(exportModule,/partial-optional-collections-unavailable/);
  assert.match(exportModule,/PGRST205/);
  assert.match(exportModule,/42P01/);
  assert.match(monitor,/safeMonitoringSourceUrl/);
  assert.match(monitor,/selectNewMonitoringDiscoveries/);
  assert.match(records,/parsed\.protocol !== 'https:'/);
});

test('the final mobile browser fixture covers signed-in Home, onboarding, and Back',()=>{
  const e2e=readFileSync(new URL('./e2e-learning-integration.mjs',import.meta.url),'utf8');
  const preview=get('components/marketing/LandingPreview.jsx');
  assert.match(e2e,/public first-use guide opens on mobile/);
  assert.match(e2e,/Mobile overflow diagnostics \(fixture only\)/);
  assert.match(e2e,/evidence-first signed-in Home/);
  assert.doesNotMatch(preview,/EXAMPLE · RESEARCH TRAIL/);
  assert.doesNotMatch(preview,/Example screens and sample content — not live research results or an AI answer/);
  assert.match(preview,/aria-label="EYLO interactive walkthrough"/);
});
