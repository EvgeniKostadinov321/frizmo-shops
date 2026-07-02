"use client";

import { useId, type InputHTMLAttributes } from "react";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
}

export function Checkbox({ label, hint, className = "", id, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex min-h-11 items-center gap-3">
        <input
          id={inputId}
          type="checkbox"
          className={`size-5 shrink-0 rounded accent-brand-600 ${className}`}
          {...props}
        />
        <span className="text-sm font-medium text-ink-900">{label}</span>
      </label>
      {hint && <p className="pl-8 text-sm text-ink-500">{hint}</p>}
    </div>
  );
}
