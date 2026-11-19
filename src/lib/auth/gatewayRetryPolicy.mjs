// When a proxy returns an ambiguous transport failure, retrying a write can
// execute the same operation twice (including Auth OTP/refresh-token POSTs).
// Restrict transparent direct-provider failover to idempotent read requests.
export function mayRetrySupabaseGatewayRequest(input, init = {}) {
  const method = init?.method
    || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
  return ['GET', 'HEAD'].includes(String(method).toUpperCase());
}
