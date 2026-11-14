import { diagnoseConfiguration } from '../server/configuration-diagnostics.mjs';

const report = diagnoseConfiguration();
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.decision === 'CONFIGURATION_PRESENT' ? 0 : 1;
