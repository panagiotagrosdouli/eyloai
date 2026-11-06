import { readFileSync } from 'node:fs';
import { evaluateAdjudicatedEvidence } from '../src/lib/eyra-human-evaluation.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--dataset') {
  console.error('Usage: npm run evaluate:eyra:human -- --dataset /private/path/to/adjudicated-cases.json');
  console.error('No corpus has been provided or evaluated. Run requires real independently adjudicated labels and recorded reviewer outputs.');
  process.exitCode = 2;
} else {
  try {
    const json = JSON.parse(readFileSync(args[1], 'utf8'));
    const result = evaluateAdjudicatedEvidence(json);
    console.log(JSON.stringify(result, null, 2));
    console.log(result.screening_passed
      ? 'SCREENING THRESHOLDS MET (NOT launch approval; independent audit and live checks still required).'
      : 'SCIENTIFIC SCREENING: NO-GO (insufficient data, uncertainty, recall or false acceptance gate).');
    if (!result.screening_passed) process.exitCode = 1;
  } catch (error) {
    console.error('Evaluation refused: ' + (error instanceof Error ? error.message : 'Invalid dataset.'));
    process.exitCode = 2;
  }
}
