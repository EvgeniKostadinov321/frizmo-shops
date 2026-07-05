import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Маскотът на Frizmo в празни/success състояния на storefront-а.
 * Нарочно ДИСКРЕТЕН: малък статичен PNG, не видео/анимация — магазинът е на
 * търговеца, маскотът е само топъл акцент, не бранд превземане.
 */
const POSES = {
  peek: "/bee-peek.png",
  wave: "/bee-wave.png",
  /** С лупа, чеше се по главата — „не намерихме" (404, празно търсене). */
  lost: "/bee-lost.png",
  /** Показва празна кошница — празна количка. */
  basket: "/bee-basket.png",
} as const;

export function MascotState({
  pose = "peek",
  title,
  text,
  action,
}: {
  pose?: keyof typeof POSES;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      <Image
        src={POSES[pose]}
        alt=""
        aria-hidden
        width={140}
        height={140}
        className="h-32 w-auto object-contain sm:h-36"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-medium text-(--sf-text)">{title}</p>
        {text && <p className="max-w-sm text-sm text-(--sf-muted)">{text}</p>}
      </div>
      {action}
    </div>
  );
}
