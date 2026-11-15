import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const assetDir = join(process.cwd(), 'dist', 'assets');
const budget = Number(process.env.EYLO_MAX_JS_CHUNK_BYTES || 700_000);
if (!Number.isSafeInteger(budget) || budget <= 0) {
  console.error('EYLO_MAX_JS_CHUNK_BYTES must be a positive integer.');
  process.exit(2);
}
let filenames;
try {
  filenames = (await readdir(assetDir)).filter(name => name.endsWith('.js'));
} catch {
  console.error('No production build assets found. Run npm run build first.');
  process.exit(2);
}
if (!filenames.length) {
  console.error('No JavaScript chunks found in the production output.');
  process.exit(2);
}

const chunks = await Promise.all(filenames.map(async name => {
  const bytes = await readFile(join(assetDir, name));
  return { name, bytes: bytes.length, gzip: gzipSync(bytes).length };
}));
chunks.sort((a, b) => b.bytes - a.bytes);
const fmt = n => (n / 1024).toFixed(1) + ' KiB';
console.log('EYLO production bundle budget (largest minified JS chunk):');
for (const chunk of chunks.slice(0, 8)) {
  console.log(`  ${chunk.name}: ${fmt(chunk.bytes)} (gzip ${fmt(chunk.gzip)})`);
}
console.log(`  Budget: ${fmt(budget)}; largest chunk: ${fmt(chunks[0].bytes)}`);
if (chunks[0].bytes > budget) {
  console.error('Bundle budget exceeded. Consider route-level code splitting or record an explicitly reviewed budget change.');
  process.exit(1);
}
