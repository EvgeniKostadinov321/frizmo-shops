"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

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

  const isDark = theme === "dark";
  const label = isDark ? "Светла тема" : "Тъмна тема";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="group relative flex size-11 items-center justify-center rounded-control text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {/* Слънце и луна са наслоени; при смяна на темата се разменят с
          завъртане + избледняване (motion-reduce → просто toggle без анимация). */}
      <span className="relative size-5">
        <Icon
          name="sun"
          size={20}
          className={`absolute inset-0 transition-all duration-300 ease-out motion-reduce:transition-none ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Icon
          name="moon"
          size={20}
          className={`absolute inset-0 transition-all duration-300 ease-out motion-reduce:transition-none ${
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}
