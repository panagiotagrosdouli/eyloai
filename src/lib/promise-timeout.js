export function promiseWithTimeout(promise, timeoutMs, message, onTimeout) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        try {
          onTimeout?.();
        } finally {
          reject(new Error(message));
        }
      }, timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeoutId));
}
