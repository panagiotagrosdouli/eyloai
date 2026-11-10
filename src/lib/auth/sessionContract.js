/** A successful password sign-in must include a usable token and matching user ID. */
export function hasAuthenticatedSignIn(data) {
  return Boolean(data?.session?.access_token && data?.user?.id && data?.session?.user?.id === data.user.id);
}
