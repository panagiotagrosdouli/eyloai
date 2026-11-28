export function createEyraDiscoveryProgressEmitter(onProgress, signal) {
  let active = typeof onProgress === 'function' && !signal?.aborted;
  const stop = () => { active = false; };
  signal?.addEventListener('abort', stop, { once: true });

  return value => {
    if (!active || signal?.aborted) return false;
    onProgress(value);
    return true;
  };
}
