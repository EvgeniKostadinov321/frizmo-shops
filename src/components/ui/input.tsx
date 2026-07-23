"use client"; // useId е hook — компонентът трябва да е client

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
  /** Скрива label-а визуално (остава за screen readers) — за плътни таблици. */
  hideLabel?: boolean;
  /** Съдържание след етикета на същия ред (напр. InfoHint икона). */
  labelSuffix?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  suffix,
  hideLabel = false,
  labelSuffix,
  className = "",
  id,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={
          hideLabel ? "sr-only" : "flex items-center gap-1.5 text-sm font-medium text-ink-900"
        }
      >
        <label htmlFor={inputId}>{label}</label>
        {props.required && (
          <span aria-hidden className="text-danger-600">
            *
          </span>
        )}
        {labelSuffix}
      </span>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={
            "h-11 w-full rounded-control border bg-surface-0 px-3 text-ink-900 transition-colors " +
            "placeholder:text-ink-500 focus:outline-2 focus:outline-offset-1 " +
            (suffix ? "pr-9 " : "") +
            (error
              ? "border-danger-600 focus:outline-danger-600 "
              : "border-surface-300 focus:outline-brand-600 ") +
            className
          }
          {...props}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-500"
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-500">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
}
