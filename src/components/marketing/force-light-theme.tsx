"use client";

import { useEffect } from "react";

/**
 * Гарантира, че публичните marketing страници са ВИНАГИ светли — маха
 * data-theme="dark", ако е останал от dashboard навигация (dark е само за
 * търговския панел). Решение 2026-07-03.
 */
export function ForceLightTheme() {
  useEffect(() => {
    delete document.documentElement.dataset.theme;
  }, []);

  return null;
}
