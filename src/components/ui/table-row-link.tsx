"use client";

import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

/**
 * Кликаем ред на таблица (десктоп). Целият `<tr>` навигира при клик — надеждно
 * през JS (CSS `position` върху table елементи е ненадеждно между браузъри).
 * Достъпност: пази истински линк вътре (обикновено на първата клетка) за
 * клавиатура/среден бутон/screen reader; JS кликът е само за удобство с мишката.
 * Клик върху интерактивен елемент (линк/бутон) в реда НЕ задейства навигацията.
 */
export function TableRowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        /* Не прехващай клик върху вложен линк/бутон (те си вършат работата) и
           middle/ctrl клик (нов таб). */
        const target = e.target as HTMLElement;
        if (target.closest("a, button")) return;
        if (e.metaKey || e.ctrlKey || e.button !== 0) return;
        router.push(href);
      }}
      className={`cursor-pointer border-b border-surface-100 transition-colors last:border-0 hover:bg-surface-50 ${className}`}
    >
      {children}
    </tr>
  );
}
