import { runFilesHostedAcceptance } from './files-hosted-ab-core.mjs';

try {
  console.log(JSON.stringify(await runFilesHostedAcceptance(process.env), null, 2));
} catch {
  // Never expose tokens, user IDs, object paths or upstream error payloads.
  console.error('Files staging acceptance failed. Verify staging configuration, Auth, Storage and cleanup privately.');
  process.exitCode = 1;
}
