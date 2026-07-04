"use client";

import { useEffect, useRef, useState } from "react";
import { TIME_OPTIONS } from "@/lib/working-hours";

interface TimeSelectProps {
  /** 24-часова стойност „HH:MM". */
  value: string;
  onChange: (value: string) => void;
  /** ARIA етикет (полето е без видим label в реда). */
  label: string;
  className?: string;
}

/**
 * Компактен 24-часов dropdown за часове — заменя native `<select>` (грозен,
 * ОС-специфичен, огромен) с брандов панел в стила на „Пазарен ден". Стойността е
 * винаги „HH:MM" на половин час; ако е извън мрежата (стар запис), се добавя
 * най-отгоре. Затваря при клик отвън / Escape; scroll-ва до избрания при отваряне.
 */
export function TimeSelect({ value, onChange, label, className = "" }: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options =
    TIME_OPTIONS.some((o) => o.value === value)
      ? TIME_OPTIONS
      : [{ value, label: value }, ...TIME_OPTIONS];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    /* Скролни избрания час във видимата част при отваряне. */
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-1.5 rounded-control border border-surface-300 bg-surface-0 pl-3 pr-2.5 text-sm text-ink-900 transition-colors hover:border-brand-500 focus:outline-2 focus:outline-offset-1 focus:outline-brand-600"
      >
        <span className="tabular-nums">{value}</span>
        <span aria-hidden className={`text-ink-500 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-1 max-h-56 w-full min-w-24 overflow-auto rounded-card border border-surface-200 bg-surface-0 py-1 shadow-float"
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-1.5 text-left text-sm tabular-nums transition-colors ${
                    selected
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-ink-900 hover:bg-surface-50"
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
