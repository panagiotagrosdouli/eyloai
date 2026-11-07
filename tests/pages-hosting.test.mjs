import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('GitHub Pages builds from Vite output and verifies deployed release', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  assert.match(workflow, /EYLO_GITHUB_PAGES: 'true'/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /upload-pages-artifact@v4/);
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /release\.git_commit !== process\.env\.GITHUB_SHA/);
});

test('Client router and brand assets respect /eyloai/ project hosting', () => {
  assert.match(read('vite.config.js'), /base: process\.env\.EYLO_GITHUB_PAGES/);
  assert.match(read('src/App.jsx'), /Router basename=/);
  assert.match(read('src/components/brand/BrandLogo.jsx'), /import\.meta\.env\.BASE_URL/);
  assert.match(read('src/pages/Landing.jsx'), /import\.meta\.env\.BASE_URL/);
});

test('Pages publication cannot silently claim the deleted Vercel domain', () => {
  const vite = read('vite.config.js');
  assert.match(vite, /eylo-github-pages-canonical/);
  assert.match(vite, /https:\/\/panagiotagrosdouli\.github\.io\/eyloai\//);
  const smoke = read('.github/workflows/public-production-smoke.yml');
  assert.doesNotMatch(smoke, /push:\s*\n\s*branches:/);
  assert.match(smoke, /workflow_dispatch:/);
});

test('Public research discovery remains discipline-neutral', () => {
  const landing = read('src/pages/Landing.jsx');
  const discover = read('src/pages/PublicDiscovery.jsx');
  for (const content of [landing, discover]) {
    assert.doesNotMatch(content, /Visual[- ]inertial|ORB-SLAM|autonomous vehicles/i);
  }
  assert.match(landing, /A better way to/);
  assert.match(landing, /explore research/);
  assert.match(landing, /source-linked research/i);
  assert.match(landing, /Enter EYLO AI/);
  assert.match(landing, /to="\/discover"/);
  assert.doesNotMatch(landing, /role="search"/);
  assert.doesNotMatch(landing, /searchOpenAlexWorks/);
});

test('Corporate sections are separate routes from public EYLO AI discovery', () => {
  const app = read('src/App.jsx');
  const landing = read('src/pages/Landing.jsx');
  const company = read('src/pages/CompanyPage.jsx');
  assert.match(app, /path="\/company"/);
  assert.match(app, /path="\/company\/:section"/);
  assert.match(app, /path="\/discover"/);
  for (const segment of ['what-we-do', 'vision', 'careers']) {
    assert.ok(landing.includes('/company/' + segment));
    assert.ok(company.includes(segment));
  }
  assert.match(company, /Enter EYLO AI/);
});

test('Pages deploy uses the public Supabase configuration without empty GitHub Secret overrides', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  assert.match(workflow, /verify-pages-auth-env\.mjs/);
  assert.doesNotMatch(workflow, /VITE_SUPABASE_URL:\s*\$\{\{ secrets\./);
  assert.doesNotMatch(workflow, /VITE_SUPABASE_ANON_KEY:\s*\$\{\{ secrets\./);
});

test('Static Pages discovery does not call missing same-origin server functions', () => {
  const discovery = read('src/lib/eyra-api.js');
  assert.match(discovery, /staticPagesHost = import\.meta\.env\?\.BASE_URL === '\/eyloai\/'/);
  assert.match(discovery, /!staticPagesHost/);
  assert.match(discovery, /return fetchWithTimeout\(directUrl, options\)/);
});

test('Account and recovery links preserve GitHub Pages routing base', () => {
  for (const path of ['src/pages/Login.jsx', 'src/pages/Register.jsx', 'src/pages/ForgotPassword.jsx']) {
    const source = read(path);
    assert.match(source, /import\.meta\.env\.BASE_URL/);
  }
  assert.match(read('src/pages/Register.jsx'), /window\.location\.assign/);
});

test('Public professor finder is accessible without authentication and does not fabricate bookings', () => {
  const app = read('src/App.jsx');
  const finder = read('src/pages/PublicResearchers.jsx');
  const discovery = read('src/pages/PublicDiscovery.jsx');
  assert.ok(app.includes('path="/find-researchers"'));
  assert.ok(discovery.includes('to="/find-researchers"'));
  assert.ok(finder.includes('searchOpenAlexAuthors'));
  assert.ok(finder.includes('searchResearchPeopleByPublications'));
  assert.ok(finder.includes('Prepare inquiry'));
  assert.ok(finder.includes('A meeting is confirmed only when the researcher agrees'));
});

test('Supabase email redirects are documented for the GitHub Pages project path', () => {
  const guide = read('docs/GITHUB_PAGES_AUTH_CONFIGURATION.md');
  assert.ok(guide.includes('github.io/eyloai/auth/callback'));
  assert.ok(guide.includes('github.io/eyloai/reset-password'));
  assert.ok(guide.includes('Authentication'));
  const callback = read('src/pages/AuthCallback.jsx');
  assert.ok(callback.includes('window.history.replaceState'));
  assert.ok(callback.includes('destination.slice(1)'));
});

test('Public researcher outreach never claims mail app opening sends a message', () => {
  const finder = read('src/pages/PublicResearchers.jsx');
  assert.ok(finder.includes('mailto:'));
  assert.ok(finder.includes('institutionalEmail'));
  assert.ok(finder.includes('OUTREACH_KEY'));
  assert.ok(finder.includes('Opening your email app does not send the message'));
  assert.ok(finder.includes('A meeting is confirmed only when the researcher agrees'));
  assert.ok(finder.includes('Browser storage'));
});
