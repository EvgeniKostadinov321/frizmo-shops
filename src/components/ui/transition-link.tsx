"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

interface TransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** Извиква се веднага при клик (напр. за да маркираш кой елемент е активен). */
  onNavigate?: () => void;
  "aria-current"?: "true" | "page" | undefined;
}

/**
 * Filter/pagination линк с loading state — заменя чист `<Link>` за
 * searchParams навигация (сървърен компонент се презарежда, Next НЕ показва
 * loading.tsx за searchParams-only промяна на вече монтиран route). Без това
 * бавна мрежа изглежда като „бутонът не работи" → потребителят кликва отново
 * върху други филтри → множество излишни заявки едновременно.
 *
 * `useTransition` държи `isPending = true` през целия RSC round-trip (React
 * 19 знае кога route-ът реално е готов — за разлика от ръчен setState).
 * Докато е pending, нов клик тук се игнорира — решава двойните кликове.
 */
export function TransitionLink({
  href,
  children,
  className = "",
  onNavigate,
  ...rest
}: TransitionLinkProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      aria-busy={pending || undefined}
      onClick={(e) => {
        e.preventDefault();
        if (pending) return; // навигация вече в ход — игнорирай допълнителни кликове
        onNavigate?.();
        startTransition(() => {
          router.push(href);
        });
      }}
      className={`${className} ${pending ? "cursor-wait opacity-60" : ""}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
