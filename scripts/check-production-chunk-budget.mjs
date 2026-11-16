import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Baseline: 2026-11-16 main Build workflow reported MeetingRoom 593.45 kB
// minified/156.17 kB gzip, index 491.91 kB minified. This is a regression
// ceiling, not a measured first-load performance threshold.
const cap = Number(process.env.EYLO_MAX_JS_CHUNK_BYTES || 700_000);
if (!Number.isSafeInteger(cap) || cap <= 0) {
  throw new Error('EYLO_MAX_JS_CHUNK_BYTES must be a positive integer.');
}

const folder = join(process.cwd(), 'dist', 'assets');
const files = (await readdir(folder)).filter(name => name.endsWith('.js'));
if (!files.length) throw new Error('No JS assets found. Run the production build first.');

const sizes = await Promise.all(files.map(async name => {
  const buffer = await readFile(join(folder, name));
  return { name, minifiedBytes: buffer.byteLength, gzipBytes: gzipSync(buffer).byteLength };
}));
sizes.sort((a, b) => b.minifiedBytes - a.minifiedBytes);
const largest = sizes[0];
const toKiB = n => (n / 1024).toFixed(1) + ' KiB';
console.log('Largest production JavaScript chunks (minified / gzip):');
for (const chunk of sizes.slice(0, 5)) {
  console.log(`  ${chunk.name}: ${toKiB(chunk.minifiedBytes)} / ${toKiB(chunk.gzipBytes)}`);
}
console.log(`Regression ceiling: ${toKiB(cap)} per minified JavaScript chunk`);
if (largest.minifiedBytes > cap) {
  throw new Error(`Largest chunk ${largest.name} exceeded the reviewed size ceiling. Split code or document an intentional budget change.`);
}
