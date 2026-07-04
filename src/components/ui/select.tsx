"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

/** Event-съвместим shape → callers остават `onChange={(e) => ...e.target.value}`. */
type SelectChangeEvent = { target: { value: string } };

export interface SelectProps {
  label: string;
  options: SelectOption[];
  /** Контролиран режим (dashboard). Пропусни за uncontrolled форма (каталог). */
  value?: string;
  /** Подава event-подобен обект `{ target: { value } }` — като native select. */
  onChange?: (e: SelectChangeEvent) => void;
  /** Uncontrolled начална стойност (native form поле със `name`). */
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  /** Скрива label-а визуално (остава за screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/**
 * Брандов custom dropdown — заменя native `<select>` (ОС-специфичен и грозен,
 * особено на iPhone). Панел в стила на „Пазарен ден"; затваря при клик отвън /
 * Escape; клавиатура (стрелки, Enter). Скрит `<input>` носи стойността във форми.
 *
 * ВНИМАНИЕ: onChange подава директно новата стойност (string), НЕ event —
 * различно от native select. Викащите: `onChange={(v) => ...}`.
 */
export function Select({
  label,
  options,
  value: controlledValue,
  onChange,
  defaultValue = "",
  placeholder,
  error,
  hint,
  required,
  name,
  disabled,
  hideLabel = false,
  className = "",
}: SelectProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /* Uncontrolled fallback за native форми (каталог): вътрешен state от defaultValue. */
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "Избери…";
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function choose(v: string) {
    if (!isControlled) setInternalValue(v);
    onChange?.({ target: { value: v } });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
      return;
    }
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        choose(options[activeIndex]!.value);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={hideLabel ? "sr-only" : "text-sm font-medium text-ink-900"}>
        <label htmlFor={inputId}>{label}</label>
        {required && (
          <span aria-hidden className="text-danger-600">
            {" "}
            *
          </span>
        )}
      </span>

      <div ref={containerRef} className={`relative ${className}`}>
        {name && <input type="hidden" name={name} value={value} />}
        <button
          id={inputId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={
            "flex h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface-0 pl-3 pr-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-2 focus:outline-offset-1 " +
            (error
              ? "border-danger-600 focus:outline-danger-600 "
              : "border-surface-300 hover:border-brand-500 focus:outline-brand-600 ")
          }
        >
          <span className={selected ? "truncate text-ink-900" : "truncate text-ink-500"}>
            {displayLabel}
          </span>
          <span aria-hidden className={`shrink-0 text-ink-500 transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            aria-label={label}
            className="absolute z-40 mt-1 max-h-60 w-full min-w-max overflow-auto rounded-card border border-surface-200 bg-surface-0 py-1 shadow-float"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(opt.value)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-brand-50 font-semibold text-brand-700"
                        : isActive
                          ? "bg-surface-50 text-ink-900"
                          : "text-ink-900"
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

      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
