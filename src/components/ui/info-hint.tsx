"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icon";

interface InfoHintProps {
  /** Пояснителният текст (кратко изречение или няколко). */
  label: string;
  /** ARIA етикет на бутона — за какво е инфо иконата (за screen readers). */
  ariaLabel?: string;
  /** Подравняване на балона спрямо иконата (end = до десния ръб). */
  align?: "start" | "end";
}

/**
 * Достъпна инфо-икона с изскачащо пояснение. Показва се при HOVER (десктоп) И
 * при КЛИК/ТАП (мобилно — за разлика от чистия hover tooltip). Затваря се с
 * Escape / клик отвън. Съдържанието е реален текст за screen readers (не
 * aria-hidden). Допълва видимия етикет — никога не го замества.
 */
export function InfoHint({ label, ariaLabel = "Повече информация", align = "start" }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const visible = open || hovered;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-5 items-center justify-center rounded-full text-ink-400 transition-colors hover:text-ink-700 focus-visible:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
      >
        <Icon name="help-circle" size={16} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full z-50 mt-1.5 w-max max-w-64 rounded-control bg-ink-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-surface-50 shadow-float transition-opacity duration-150 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        } ${align === "end" ? "right-0" : "left-0"}`}
      >
        {label}
      </span>
    </span>
  );
}
