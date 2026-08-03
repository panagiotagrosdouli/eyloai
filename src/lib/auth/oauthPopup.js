export const OAUTH_COMPLETE_MESSAGE = 'eylo:oauth-complete';

const POPUP_FEATURES = 'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes';

export function openOAuthPopup() {
  return window.open('about:blank', 'eylo-oauth', POPUP_FEATURES);
}

export function navigateOAuthPopup(popup, url) {
  if (!popup || popup.closed) return false;
  popup.location.replace(url);
  popup.focus();
  return true;
}
