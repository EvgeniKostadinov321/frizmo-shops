"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { InstallGuideModal } from "./install-guide-modal";

/**
 * Самостоятелен бутон „Инсталирай приложението" + вградения install modal.
 * Позволява hero-то (server component) да покаже CTA за PWA без да става client.
 */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-13 items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-6 text-sm font-medium text-ink-700 transition-colors hover:border-surface-300 hover:text-ink-900 ${className}`}
      >
        <Icon name="phone" size={16} className="shrink-0" />
        Инсталирай приложението
      </button>
      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
