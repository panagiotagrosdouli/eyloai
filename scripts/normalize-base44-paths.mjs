import { readdir, rename, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

function normalizeSegment(segment) {
  return segment.trim();
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(absolute)));
    } else {
      results.push(absolute);
    }
  }

  return results;
}

function normalizedRelativePath(absolutePath) {
  const relative = path.relative(root, absolutePath);
  return relative
    .split(path.sep)
    .map(normalizeSegment)
    .filter(Boolean)
    .join(path.sep);
}

const files = await walk(root);
const moves = files
  .map((source) => ({ source, destination: path.join(root, normalizedRelativePath(source)) }))
  .filter(({ source, destination }) => source !== destination)
  .sort((a, b) => b.source.length - a.source.length);

if (moves.length === 0) {
  console.log('No malformed Base44 paths found.');
  process.exit(0);
}

for (const { source, destination } of moves) {
  try {
    await stat(destination);
    throw new Error(`Refusing to overwrite existing path: ${path.relative(root, destination)}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await rename(source, destination);
  console.log(`${path.relative(root, source)} -> ${path.relative(root, destination)}`);
}

console.log(`Normalized ${moves.length} Base44 file path(s).`);
