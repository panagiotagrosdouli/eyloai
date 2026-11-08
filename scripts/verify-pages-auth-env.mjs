import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }),
);

const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  throw new Error('GitHub Pages requires a valid public Supabase URL in .env.production.');
}
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
  throw new Error('GitHub Pages requires a Supabase publishable browser key in .env.production.');
}
if (/^VITE_(?:SUPABASE_SECRET|SUPABASE_SERVICE_ROLE|SERVICE_ROLE)/m.test(envText)) {
  throw new Error('Never include secret/service-role keys in public Vite environment files.');
}

console.log('GitHub Pages public Supabase environment configuration is present and formatted correctly (values withheld).');
