"use client";

import { Icon } from "./icon";

interface SelectCheckboxProps {
  checked: boolean;
  onChange: () => void;
  "aria-label": string;
  /** Полу-избрано състояние (напр. „избери всички", когато част са избрани). */
  indeterminate?: boolean;
}

/**
 * Брандиран чекбокс за селекция на редове — изглежда еднакво на всички
 * браузъри/OS (native `accent-color` е грозен и различен навсякъде). Реалният
 * `<input>` е скрит (peer), визуалната кутия се рисува от нас.
 */
export function SelectCheckbox({ checked, onChange, indeterminate, ...rest }: SelectCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
        aria-label={rest["aria-label"]}
      />
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-md border-2 border-surface-300 bg-surface-0 text-surface-0 transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500"
      >
        {(checked || indeterminate) && (
          <Icon name={indeterminate ? "minus" : "check"} size={14} className="stroke-[3]" />
        )}
      </span>
    </label>
  );
}
