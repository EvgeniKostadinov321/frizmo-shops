"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "frizmo-theme";

/**
 * Light/dark toggle: сменя data-theme на <html> (токените се предефинират —
 * виж docs/decisions/2026-07-03-dark-mode.md). Anti-FOUC скриптът в root
 * layout-а прилага записания избор преди първото рисуване.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    window.localStorage.setItem(THEME_KEY, next);
  }

  if (!theme) return <span className="size-11" aria-hidden />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Светла тема" : "Тъмна тема"}
      title={theme === "dark" ? "Светла тема" : "Тъмна тема"}
      className="flex size-11 items-center justify-center rounded-control text-lg text-ink-700 transition-colors hover:bg-surface-100"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
