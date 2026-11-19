// Keep cancelled EYLO/EYRA research requests from updating a newer search.
// The signal belongs to one invocation, not to the global workspace.
export function createDiscoveryProgressEmitter(onProgress, signal) {
  return (progress) => {
    if (signal?.aborted) return false;
    if (typeof onProgress !== 'function') return false;
    onProgress(progress);
    return true;
  };
}
