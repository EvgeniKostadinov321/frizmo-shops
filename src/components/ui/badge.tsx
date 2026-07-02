import { type HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-100 text-ink-700",
  success: "bg-brand-50 text-success-600",
  warning: "bg-surface-100 text-warning-600",
  danger: "bg-surface-100 text-danger-600",
  brand: "bg-brand-100 text-brand-700",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
