"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Рендерира се само за собственика: опреснява страницата при сигнал от редактора. */
export function PreviewListener() {
  const router = useRouter();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data === "frizmo-preview-refresh") router.refresh();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
