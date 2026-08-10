import { applyTheme } from '@/lib/theme';

export const DEFAULT_PREFERENCES = {
  language: 'en',
  theme: 'dark',
  accent: 'blue',
  voice_style: 'professional',
  accessibility: [],
  ai_response_style: 'balanced',
  notifications_browser: false,
  data_personalization: true,
};

const STORAGE_KEY = 'eylo_prefs';
const EVENT = 'eylo:preferences';

export const LANGUAGE_LOCALES = {
  en: 'en-US',
  el: 'el-GR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  tr: 'tr-TR',
};

const ACCENTS = {
  blue: ['213 94% 55%', '217 91% 60%'],
  purple: ['264 83% 63%', '271 81% 56%'],
  teal: ['173 80% 40%', '174 72% 45%'],
  green: ['142 71% 45%', '142 69% 50%'],
  orange: ['25 95% 53%', '20 90% 48%'],
  red: ['0 84% 60%', '0 72% 51%'],
};

function normalize(raw = {}) {
  const accessibility = Array.isArray(raw.accessibility)
    ? raw.accessibility.filter(Boolean)
    : [];

  return {
    ...DEFAULT_PREFERENCES,
    ...raw,
    accessibility,
  };
}

export function loadPreferences() {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function getPreferenceLocale(preferences = loadPreferences()) {
  return LANGUAGE_LOCALES[preferences.language]
    || window.navigator?.language
    || 'en-US';
}

export function applyPreferences(preferences = loadPreferences()) {
  if (typeof document === 'undefined') return preferences;
  const prefs = normalize(preferences);
  const root = document.documentElement;
  const locale = getPreferenceLocale(prefs);
  const [primary, accent] = ACCENTS[prefs.accent] || ACCENTS.blue;

  applyTheme(prefs.theme);
  root.lang = locale.split('-')[0];
  root.dir = prefs.language === 'ar' ? 'rtl' : 'ltr';
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--accent-brand', accent);

  ['comfort', 'focus', 'high_contrast', 'large_text', 'reading'].forEach((mode) => {
    root.classList.toggle(`a11y-${mode.replace('_', '-')}`, prefs.accessibility.includes(mode));
  });

  return prefs;
}

export function savePreferences(patch) {
  const preferences = normalize({ ...loadPreferences(), ...patch });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  applyPreferences(preferences);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: preferences }));
  return preferences;
}

export function subscribePreferences(callback) {
  const handler = (event) => callback(event.detail || loadPreferences());
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function initPreferences() {
  const preferences = applyPreferences(loadPreferences());
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = () => {
    if (loadPreferences().theme === 'system') applyPreferences();
  };
  media.addEventListener?.('change', onSchemeChange);
  return preferences;
}
