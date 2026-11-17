import { validateEyraHostedStagingConfig, runEyraHostedStagingAcceptance } from './eyra-hosted-ab-core.mjs';

// Deliberately opt-in. No Supabase client, env values, or network requests are
// constructed until every production guard and both JWT sanity checks pass.
try {
  const config = validateEyraHostedStagingConfig(process.env);
  const result = await runEyraHostedStagingAcceptance(config);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  // All errors from our runner are intentionally sanitized and contain no JWTs,
  // tokens, emails, user IDs, SQL error content or response payloads.
  console.error(error instanceof Error ? error.message : 'EYRA staging acceptance failed safely.');
  process.exitCode = 1;
}
