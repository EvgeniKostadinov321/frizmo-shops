"use client";

import { useId, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  rows = 4,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-900">
        <label htmlFor={inputId}>{label}</label>
        {props.required && (
          <span aria-hidden className="text-danger-600">
            {" "}
            *
          </span>
        )}
      </span>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={
          "resize-y rounded-control border bg-surface-0 px-3 py-2.5 text-ink-900 transition-colors " +
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
