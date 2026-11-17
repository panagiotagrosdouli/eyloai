import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun, X } from 'lucide-react';
import { hasChosenTheme, savePreferences, subscribePreferences } from '@/lib/preferences';

// The first visit is a real choice, not a permanent modal blocking access to
// public papers, login, or assistive navigation. Any existing preference wins.
export default function ThemeWelcomeChoice() {
  const [visible, setVisible] = useState(() => !hasChosenTheme());
  useEffect(() => subscribePreferences(() => {
    if (hasChosenTheme()) setVisible(false);
  }), []);
  if (!visible) return null;

  const select = theme => {
    savePreferences({ theme });
    setVisible(false);
  };

  return (
    <aside
      aria-label="Choose your EYLO appearance"
      className="fixed bottom-4 left-4 right-4 z-[95] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-primary">Welcome to EYLO</p>
          <h2 className="mt-1 text-base font-semibold">Choose your appearance</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Light or dark? Your choice stays on this device, and you can change it any time.
          </p>
        </div>
        <button type="button" onClick={() => setVisible(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Choose appearance later"><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Appearance options">
        <button type="button" onClick={() => select('light')} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-2 text-xs font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Sun size={17} aria-hidden="true" /> Light
        </button>
        <button type="button" onClick={() => select('dark')} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-2 text-xs font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Moon size={17} aria-hidden="true" /> Dark
        </button>
        <button type="button" onClick={() => select('system')} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-2 text-xs font-semibold hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Monitor size={17} aria-hidden="true" /> System
        </button>
      </div>
    </aside>
  );
}
