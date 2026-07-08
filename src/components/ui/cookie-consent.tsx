"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./button";

const CONSENT_KEY = "frizmo-cookie-notice";

/**
 * Cookie банер: ползваме само строго необходими бисквитки (вход/сесия), без
 * маркетингови/проследяващи. Opt-in законът важи за non-essential cookies — нямаме
 * такива, затова „Приемам" без избор на категории (няма какво да се opt-in-ва).
 * Щом дойде аналитика/pixel → пълен opt-in с категории.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !window.localStorage.getItem(CONSENT_KEY)) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Съобщение за бисквитки"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-200 bg-surface-0 p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-700">
          Използваме само строго необходими бисквитки — за вход и сесия. Без проследяване,
          без реклами.{" "}
          <Link href="/privacy" className="text-brand-600 underline">
            Научи повече
          </Link>
        </p>
        <Button
          size="sm"
          onClick={() => {
            window.localStorage.setItem(CONSENT_KEY, "1");
            setVisible(false);
          }}
        >
          Приемам
        </Button>
      </div>
    </div>
  );
}
