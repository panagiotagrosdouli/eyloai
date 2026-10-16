export const AppErrorCode = Object.freeze({
  CONFIGURATION: 'configuration_error',
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
  USER_ALREADY_REGISTERED: 'user_already_registered',
  WEAK_PASSWORD: 'weak_password',
  RATE_LIMITED: 'rate_limited',
  NETWORK: 'network_error',
  PROVIDER_DISABLED: 'provider_disabled',
  EXPIRED_RECOVERY_LINK: 'expired_recovery_link',
  SIGNUP_DISABLED: 'signup_disabled',
  EMAIL_SEND_FAILED: 'email_send_failed',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INVALID_EMAIL: 'invalid_email',
  UNKNOWN: 'unknown_error',
});

const messages = {
  [AppErrorCode.CONFIGURATION]: 'Authentication is temporarily unavailable.',
  [AppErrorCode.INVALID_CREDENTIALS]: 'The email or password is incorrect.',
  [AppErrorCode.EMAIL_NOT_CONFIRMED]: 'Confirm your email address before signing in.',
  [AppErrorCode.USER_ALREADY_REGISTERED]: 'An account already exists for this email address.',
  [AppErrorCode.WEAK_PASSWORD]: 'Choose a stronger password with at least 8 characters.',
  [AppErrorCode.RATE_LIMITED]: 'Too many attempts. Please wait and try again.',
  [AppErrorCode.NETWORK]: 'Unable to reach the authentication service. Check your connection and retry.',
  [AppErrorCode.PROVIDER_DISABLED]: 'This sign-in provider is not available.',
  [AppErrorCode.EXPIRED_RECOVERY_LINK]: 'This recovery link is invalid or has expired.',
  [AppErrorCode.SIGNUP_DISABLED]: 'New registrations are temporarily disabled. Contact EYLO support.',
  [AppErrorCode.EMAIL_SEND_FAILED]: 'Your account could not be confirmed because the email service failed. Please try again later.',
  [AppErrorCode.SERVICE_UNAVAILABLE]: 'The account service is temporarily unavailable. Please try again later.',
  [AppErrorCode.INVALID_EMAIL]: 'Enter a valid email address and try again.',
  [AppErrorCode.UNKNOWN]: 'The account service rejected this request. Please try again or contact support.',
};

export function createAppError(code, cause) {
  return {
    code,
    message: messages[code] || messages[AppErrorCode.UNKNOWN],
    cause: import.meta.env?.DEV ? cause : undefined,
  };
}

export function mapSupabaseError(error) {
  if (!error) return null;

  const message = String(error.message || '').toLowerCase();
  const status = Number(error.status || 0);
  const providerCode = String(error.code || '').toLowerCase();

  if (providerCode === 'signup_disabled' || message.includes('signups not allowed') || message.includes('signup is disabled')) return createAppError(AppErrorCode.SIGNUP_DISABLED, error);
  if (providerCode === 'email_address_invalid' || message.includes('email address is invalid') || message.includes('invalid email')) return createAppError(AppErrorCode.INVALID_EMAIL, error);
  if (providerCode === 'email_address_not_authorized' || providerCode === 'unexpected_failure' && message.includes('email') || message.includes('error sending confirmation email') || message.includes('error sending email')) return createAppError(AppErrorCode.EMAIL_SEND_FAILED, error);
  if (status >= 500 || providerCode === 'over_request_rate_limit') return createAppError(AppErrorCode.SERVICE_UNAVAILABLE, error);
  if (message.includes('invalid login credentials')) return createAppError(AppErrorCode.INVALID_CREDENTIALS, error);
  if (message.includes('email not confirmed')) return createAppError(AppErrorCode.EMAIL_NOT_CONFIRMED, error);
  if (message.includes('already registered') || message.includes('already been registered')) return createAppError(AppErrorCode.USER_ALREADY_REGISTERED, error);
  if (message.includes('password') && (message.includes('weak') || message.includes('least'))) return createAppError(AppErrorCode.WEAK_PASSWORD, error);
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) return createAppError(AppErrorCode.RATE_LIMITED, error);
  if (message.includes('provider') && (message.includes('disabled') || message.includes('not enabled'))) return createAppError(AppErrorCode.PROVIDER_DISABLED, error);
  if (message.includes('expired') || message.includes('invalid token')) return createAppError(AppErrorCode.EXPIRED_RECOVERY_LINK, error);
  if (message.includes('fetch') || message.includes('network') || message.includes('failed to connect') || message.includes('load failed')) return createAppError(AppErrorCode.NETWORK, error);

  return createAppError(AppErrorCode.UNKNOWN, error);
}
