"use client"; // useId е hook — компонентът трябва да е client

import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = "", id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={
          "h-11 rounded-control border bg-surface-0 px-3 text-ink-900 transition-colors " +
          "placeholder:text-ink-500 focus:outline-2 focus:outline-offset-1 " +
          (error
            ? "border-danger-600 focus:outline-danger-600 "
            : "border-surface-300 focus:outline-brand-600 ") +
          className
        }
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-sm text-ink-500">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
}
