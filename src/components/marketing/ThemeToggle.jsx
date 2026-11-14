import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { savePreferences, subscribePreferences } from "@/lib/preferences";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.classList.contains("dark"));
    const unsubscribe = subscribePreferences(update);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", update);
    return () => {
      unsubscribe();
      media.removeEventListener?.("change", update);
    };
  }, []);
  const label = dark ? "Switch to day mode" : "Switch to night mode";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        savePreferences({ theme: dark ? "light" : "dark" });
        setDark(!dark);
      }}
      className="company-theme-toggle grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] text-[var(--company-ink)]"
    >
      {dark ? (
        <Sun size={19} aria-hidden="true" />
      ) : (
        <Moon size={19} aria-hidden="true" />
      )}
    </button>
  );
}
