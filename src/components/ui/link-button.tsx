"use client";

import Link, { useLinkStatus } from "next/link";
import { type ComponentProps, type ReactNode } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button";
import { Spinner } from "./spinner";

function PendingSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size="sm" /> : null;
}

export interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/** Линк, който изглежда като Button и показва spinner, докато навигацията тече. */
export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={`${buttonClasses(variant, size)} ${className}`} {...props}>
      <PendingSpinner />
      {children}
    </Link>
  );
}
