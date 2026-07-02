"use client";

import { useId, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
  /** Скрива label-а визуално (остава за screen readers). */
  hideLabel?: boolean;
}

export function Select({
  label,
  options,
  placeholder,
  error,
  hint,
  hideLabel = false,
  className = "",
  id,
  ...props
}: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={hideLabel ? "sr-only" : "text-sm font-medium text-ink-900"}>
        <label htmlFor={inputId}>{label}</label>
        {props.required && (
          <span aria-hidden className="text-danger-600">
            {" "}
            *
          </span>
        )}
      </span>
      <div className="relative">
        <select
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={
            "h-11 w-full appearance-none rounded-control border bg-surface-0 pl-3 pr-10 text-ink-900 transition-colors " +
            "focus:outline-2 focus:outline-offset-1 " +
            (error
              ? "border-danger-600 focus:outline-danger-600 "
              : "border-surface-300 focus:outline-brand-600 ") +
            className
          }
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
        >
          ▾
        </span>
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-500">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
}
