const SAFE_CODES = new Map([
  ["DISCOVERY_RATE_LIMIT_UNAVAILABLE", 503],
  ["DISCOVERY_RATE_LIMITED", 429],
]);

/** Consume only a small, time-bounded gateway error. Never reflect its raw body. */
export async function discoveryGatewayError(response) {
  let code = "";
  if (
    response.headers?.get("content-type")?.includes("application/json") &&
    response.body?.getReader
  ) {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      void reader.cancel().catch(() => {});
    }, 2000);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          void reader.cancel().catch(() => {});
          break;
        }
        chunks.push(value);
      }
      if (!expired && size <= 8192) {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const candidate = JSON.parse(new TextDecoder().decode(bytes))?.code;
        if (SAFE_CODES.get(candidate) === response.status) code = candidate;
      }
    } catch {
      /* A missing/malformed error body still preserves HTTP status. */
    } finally {
      clearTimeout(timeout);
      reader.releaseLock();
    }
  } else {
    try {
      await response.body?.cancel();
    } catch {
      /* No response body is needed. */
    }
  }
  return Object.assign(
    new Error(`Research request failed: ${response.status}`),
    { status: response.status, code: code || undefined },
  );
}
