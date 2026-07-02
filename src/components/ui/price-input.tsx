"use client";

import { Input, type InputProps } from "./input";

export type PriceInputProps = Omit<InputProps, "suffix" | "type" | "inputMode">;

/** Цена в EUR — държи string; сървърът валидира и конвертира с toCents(). */
export function PriceInput(props: PriceInputProps) {
  return <Input inputMode="decimal" suffix="€" placeholder="0,00" {...props} />;
}
