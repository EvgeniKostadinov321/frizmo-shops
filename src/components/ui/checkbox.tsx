"use client";

import { useId, type InputHTMLAttributes } from "react";
import { Icon } from "./icon";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
}

/**
 * Брандиран чекбокс с етикет — реалният `<input>` е скрит (peer), кутията се
 * рисува от нас с brand токените (native `accent-color` е грозен и различен на
 * всеки браузър/OS). API-то е като на native input (checked/onChange/disabled).
 */
export function Checkbox({ label, hint, className = "", id, disabled, ...props }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className={`flex min-h-11 items-center gap-3 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className={`peer sr-only ${className}`}
          {...props}
        />
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-surface-300 bg-surface-0 text-surface-0 transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
        >
          <Icon name="check" size={14} className="stroke-3" />
        </span>
        <span className="text-sm font-medium text-ink-900">{label}</span>
      </label>
      {hint && <p className="pl-8 text-sm text-ink-500">{hint}</p>}
    </div>
  );
}
