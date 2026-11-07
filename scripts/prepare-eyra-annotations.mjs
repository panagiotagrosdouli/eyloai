import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import {
  buildBlindEyraPacket, verifyIndependentEyraPackets, validateEyraSourceManifest,
} from '../src/lib/eyra-annotation-packets.mjs';

const args = process.argv.slice(2);
const readArg = key => {
  const at = args.indexOf(key);
  return at < 0 ? null : args[at + 1] || null;
};
const source = readArg('--source'), out = readArg('--out'), seed = readArg('--seed');
const reviewerA = readArg('--reviewer-a') || 'reviewer-a';
const reviewerB = readArg('--reviewer-b') || 'reviewer-b';
const keys = ['--source', '--out', '--seed', '--reviewer-a', '--reviewer-b'];
if (!source || !out || !seed || reviewerA === reviewerB
    || args.length % 2 || args.some((part, i) => i % 2 === 0 && !keys.includes(part))) {
  console.error('Usage: npm run prepare:eyra:annotations -- --source /private/candidates.json --out /private/new-empty-directory --seed STUDY-SEED [--reviewer-a reviewer-a --reviewer-b reviewer-b]');
  console.error('Input must contain only source claims and abstracts, never model answers or human labels. Output is local-only.');
  process.exitCode = 2;
} else {
  try {
    const raw = readFileSync(resolve(source), 'utf8');
    const manifest = JSON.parse(raw);
    validateEyraSourceManifest(manifest);
    const a = buildBlindEyraPacket(manifest, reviewerA, seed);
    const b = buildBlindEyraPacket(manifest, reviewerB, seed);
    verifyIndependentEyraPackets(a, b);
    // Refuse an existing target directory so we cannot overwrite annotated
    // responses or accidentally mix separate studies.
    mkdirSync(resolve(out));
    const files = [
      ['reviewer-a.json', a],
      ['reviewer-b.json', b],
      ['source-audit.json', {
        protocol: 'eyra-annotation-audit-v1',
        dataset_id: manifest.dataset_id,
        case_count: manifest.cases.length,
        source_sha256: createHash('sha256').update(raw).digest('hex'),
        seed,
        reviewer_ids: [reviewerA, reviewerB],
        warning: 'A hash and packet files do not establish true reviewer independence, expertise or human adjudication.',
      }],
    ];
    for (const [name, content] of files) {
      writeFileSync(join(resolve(out), name), JSON.stringify(content, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    console.log('Created two separate source-only reviewer packets and a study audit file in ' + resolve(out));
    console.log('Neither packet includes model verdicts, ground truth labels or adjudications.');
    console.log('Do not begin model scoring before collecting and independently adjudicating both reviewers\' answers.');
  } catch (error) {
    console.error('Annotation packet preparation refused: ' + (error instanceof Error ? error.message : 'Invalid input.'));
    process.exitCode = 2;
  }
}
