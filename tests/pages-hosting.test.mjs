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
  assert.match(landing, /Research begins with evidence/);
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
