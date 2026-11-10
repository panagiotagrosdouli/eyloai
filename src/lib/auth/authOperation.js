/** Ignore async session results after sign-out, sign-in, or token refresh events. */
export function shouldApplyAuthResult(startVersion, currentVersion, mounted) {
  return Boolean(mounted && startVersion === currentVersion);
}
