import test from 'node:test';
import assert from 'node:assert/strict';

import { getSafeRedirect } from '../src/lib/auth/safeRedirect.ts';
import {
  buildResearchWorkspaceSignupHref,
  getResearchIdeaForNewProject,
} from '../src/lib/discovery/workspaceSignup.js';

test('saving public research preserves its idea through email confirmation and opens a new project', () => {
  const signup = new URL(buildResearchWorkspaceSignupHref('climate change adaptation'), 'https://eylo.local');
  const destination = getSafeRedirect(signup.searchParams.get('from'));
  const project = new URL(destination, 'https://eylo.local');

  assert.equal(signup.pathname, '/register');
  assert.equal(project.pathname, '/projects');
  assert.equal(project.searchParams.get('new'), '1');
  assert.equal(getResearchIdeaForNewProject(project.searchParams), 'climate change adaptation');
});

test('workspace signup links safely bound long ideas and support empty searches', () => {
  const longIdea = 'x'.repeat(900);
  const signup = new URL(buildResearchWorkspaceSignupHref(longIdea), 'https://eylo.local');
  const project = new URL(getSafeRedirect(signup.searchParams.get('from')), 'https://eylo.local');

  assert.equal(getResearchIdeaForNewProject(project.searchParams).length, 500);
  const blankSignup = new URL(buildResearchWorkspaceSignupHref(''), 'https://eylo.local');
  const blankProject = new URL(getSafeRedirect(blankSignup.searchParams.get('from')), 'https://eylo.local');
  assert.equal(blankProject.pathname, '/projects');
  assert.equal(blankProject.searchParams.get('new'), '1');
});
