/**
 * Coalesce only simultaneous validation requests for the exact same access token.
 * Do not cache successful verification: later requests must still revalidate.
 * Tokens are kept only as in-memory keys until each request settles.
 */
const inFlight = new Map();

export function verifyUserOnce(accessToken, verify) {
  if (typeof accessToken !== 'string' || !accessToken) {
    return Promise.reject(new Error('An access token is required for verification.'));
  }
  const previous = inFlight.get(accessToken);
  if (previous) return previous;

  const request = Promise.resolve().then(() => verify(accessToken));
  inFlight.set(accessToken, request);
  const clear = () => {
    if (inFlight.get(accessToken) === request) inFlight.delete(accessToken);
  };
  request.then(clear, clear);
  return request;
}
