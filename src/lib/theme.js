/**
 * EYLO Theme Manager
 * Applies light/dark/system theme to the document root.
 * Call applyTheme() on app init and whenever theme pref changes.
 */

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
  } else if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    // dark (default)
    root.classList.remove('light');
    root.classList.add('dark');
  }
  localStorage.setItem('eylo_theme', theme);
}

export function initTheme() {
  const stored = localStorage.getItem('eylo_prefs');
  let theme = 'dark';
  if (stored) {
    try { theme = JSON.parse(stored).theme || 'dark'; } catch {}
  }
  applyTheme(theme);

  // Watch system preference changes for 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = localStorage.getItem('eylo_prefs');
    if (current) {
      try {
        const prefs = JSON.parse(current);
        if (prefs.theme === 'system') applyTheme('system');
      } catch {}
    }
  });
}
