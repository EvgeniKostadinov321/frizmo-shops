"use client";

import { useEffect } from "react";

/**
 * Регистрира service worker-а глобално (на всяка страница) — нужно е, за да
 * предложи браузърът „Добави към началния екран" (PWA). Push разрешението се
 * иска отделно в dashboard-а; тук само регистрираме за installability.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    /* Регистрацията е idempotent — повторните извиквания връщат същия SW */
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW не е критичен за работата на сайта — тих provaл */
    });
  }, []);

  return null;
}
