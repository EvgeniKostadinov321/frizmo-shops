import { type HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-surface-200 bg-surface-0 p-6 ${className}`}
      {...props}
    />
  );
}
