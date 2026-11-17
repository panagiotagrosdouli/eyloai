import { describeEyraFailure } from './eyra-failure-guidance.mjs';

// This only describes a known provider failure that has already occurred.
// A configured API key is not a health check, and no new paid AI request is made.
export function eyraProviderRecoveryNotice(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = Number(error?.status);

  if (code === 'OPENAI_QUOTA_EXHAUSTED') {
    return {
      title: 'EYRA AI credits are unavailable',
      message: describeEyraFailure(error),
    };
  }
  if (code === 'PLAN_LIMIT_REACHED') {
    return {
      title: 'EYRA plan limit reached',
      message: describeEyraFailure(error),
    };
  }
  if (code === 'OPENAI_RATE_LIMITED' || (status === 429 && code !== 'PLAN_LIMIT_REACHED')) {
    return {
      title: 'EYRA is temporarily rate-limited',
      message: describeEyraFailure(error),
    };
  }
  if (code === 'OPENAI_NOT_CONFIGURED' || code === 'OPENAI_AUTH_FAILED') {
    return {
      title: 'EYRA provider needs attention',
      message: describeEyraFailure(error),
    };
  }
  return null;
}
