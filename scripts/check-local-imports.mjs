import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];
const indexFiles = ['index.js', 'index.jsx', 'index.ts', 'index.tsx'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }

  return files;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function resolves(basePath) {
  for (const extension of extensions) {
    if (await exists(`${basePath}${extension}`)) return true;
  }

  for (const indexFile of indexFiles) {
    if (await exists(path.join(basePath, indexFile))) return true;
  }

  return false;
}

function localTarget(importer, specifier) {
  if (specifier.startsWith('@/')) return path.join(sourceRoot, specifier.slice(2));
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(path.dirname(importer), specifier);
  }
  return null;
}

const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const missing = [];

for (const file of await walk(sourceRoot)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] || match[2];
    const target = localTarget(file, specifier);
    if (target && !(await resolves(target))) {
      missing.push({ importer: path.relative(root, file), specifier });
    }
  }
}

if (missing.length) {
  console.error(`Missing local imports (${missing.length}):`);
  for (const item of missing) console.error(`- ${item.importer} -> ${item.specifier}`);
  process.exit(1);
}

console.log('All local imports resolve.');
