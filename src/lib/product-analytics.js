import { track } from '@vercel/analytics';

const FIRST_ACTIVATION_AT = 'eylo:first-activation-at';
const ACTIVATED_RETURN_RECORDED = 'eylo:activated-return-recorded';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function trackProductEvent(name, properties = {}) {
  if (!import.meta.env.PROD) return;
  try {
    track(name, properties);
  } catch {
    // Analytics must never interrupt a research workflow.
  }
}

export function trackSearchStarted(surface) {
  trackProductEvent('Search Started', { surface });
}

export function trackGuidedSearchCompleted({ level, goal, recency }) {
  trackProductEvent('Guided Discovery Completed', { level, goal, recency });
}

export function trackEyraActionCompleted() {
  trackProductEvent('EYRA Action Completed');
}

export function trackEyraFollowthrough(kind) {
  trackProductEvent('EYRA Followthrough', { kind });
}

export function recordActivation(kind) {
  const local = storage();
  if (!local || local.getItem(FIRST_ACTIVATION_AT)) return;

  const activatedAt = new Date().toISOString();
  local.setItem(FIRST_ACTIVATION_AT, activatedAt);
  trackProductEvent('Activation Created', { kind });
}

export function trackActivatedReturn() {
  const local = storage();
  if (!local || local.getItem(ACTIVATED_RETURN_RECORDED)) return;

  const activatedAt = local.getItem(FIRST_ACTIVATION_AT);
  if (!activatedAt) return;

  const activatedDate = new Date(activatedAt);
  if (Number.isNaN(activatedDate.getTime())) return;

  const firstDay = Date.UTC(
    activatedDate.getUTCFullYear(),
    activatedDate.getUTCMonth(),
    activatedDate.getUTCDate(),
  );
  const now = new Date();
  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceActivation = Math.floor((currentDay - firstDay) / 86_400_000);

  if (daysSinceActivation < 1 || daysSinceActivation > 7) return;

  local.setItem(ACTIVATED_RETURN_RECORDED, now.toISOString());
  trackProductEvent('Activated User Returned', { window: '1-7_days' });
}

export function redactAnalyticsEvent(event) {
  try {
    const url = new URL(event.url, window.location.origin);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/^\/projects\/[^/]+/, '/projects/project');
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
