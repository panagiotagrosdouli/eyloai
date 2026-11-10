/** A successful password sign-in must include both a user and access token. */
export function hasAuthenticatedSignIn(result) {
  return Boolean(result?.session?.access_token && result?.user?.id && result.session.user?.id === result.user.id);
}
