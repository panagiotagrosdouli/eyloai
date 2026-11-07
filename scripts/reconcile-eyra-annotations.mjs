/**
 * Local-only, no-network compilation of human annotations into an
 * adjudicator-facing DRAFT. Never writes a final human evaluation dataset.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareEyraAdjudicationDraft } from '../src/lib/eyra-adjudication-prep.mjs';

const args = process.argv.slice(2);
const required = ['--source', '--audit', '--reviewer-a', '--reviewer-b', '--out'];
const supplied = new Map();
let valid = args.length === required.length * 2;
for (let i = 0; i < args.length; i += 2) {
  if (!required.includes(args[i]) || !args[i + 1] || supplied.has(args[i])) valid = false;
  supplied.set(args[i], args[i + 1]);
}
if (!valid || required.some(key => !supplied.has(key))) {
  console.error('Usage: npm run reconcile:eyra:annotations -- --source /private/sources.json --audit /private/source-audit.json --reviewer-a /private/reviewer-a-complete.json --reviewer-b /private/reviewer-b-complete.json --out /private/NEW-adjudication-draft.json');
  console.error('Output MUST NOT exist. No model verdicts or adjudicated labels are created.');
  process.exitCode = 2;
} else {
  try {
    const read = key => readFileSync(resolve(supplied.get(key)), 'utf8');
    const draft = prepareEyraAdjudicationDraft(
      read('--source'),
      JSON.parse(read('--audit')),
      JSON.parse(read('--reviewer-a')),
      JSON.parse(read('--reviewer-b')),
    );
    writeFileSync(resolve(supplied.get('--out')), JSON.stringify(draft, null, 2) + '\n', {
      flag: 'wx', mode: 0o600,
    });
    console.log('Created local adjudication DRAFT: ' + resolve(supplied.get('--out')));
    console.log('Cases: ' + draft.case_count + '; reviewer disagreements: ' + draft.disagreement_count);
    console.log('No human ground truth or model judgments were invented; independent adjudication is required.');
  } catch (error) {
    console.error('Annotation collection refused: ' + (error instanceof Error ? error.message : 'Invalid source.'));
    process.exitCode = 2;
  }
}
