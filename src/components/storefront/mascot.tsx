import Image from "next/image";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";
import { publicImageUrl } from "@/lib/storage";

/**
 * Празни/success състояния на storefront-а. Магазинът е на ТЪРГОВЕЦА, затова
 * визуалът е негов, не платформеният Frizmo маскот:
 *  1. Има качено лого → показваме логото (кръгло каре).
 *  2. Няма лого → неутрална икона по контекст (количка, кутия, търсене).
 * Пчелата-маскот остава само за платформените екрани (dashboard/auth/PWA).
 */

/** Икона по контекст, когато магазинът няма лого. */
const ICONS = {
  cart: "shopping-cart",
  products: "store",
  search: "search",
} satisfies Record<string, IconName>;

export function MascotState({
  icon = "cart",
  logoPath,
  title,
  text,
  action,
}: {
  /** Коя неутрална икона при липса на лого. */
  icon?: keyof typeof ICONS;
  /** Логото на магазина (shop.logoPath) — показва се, ако е налично. */
  logoPath?: string | null;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      {logoPath ? (
        <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-full border border-(--sf-border) bg-(--sf-surface-raised)">
          <Image
            src={publicImageUrl(logoPath)}
            alt=""
            aria-hidden
            width={96}
            height={96}
            className="size-full object-cover"
          />
        </span>
      ) : (
        <span className="flex size-20 items-center justify-center rounded-full border border-(--sf-border) bg-(--sf-surface) text-(--sf-muted)">
          <Icon name={ICONS[icon]} size={34} />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-medium text-(--sf-text)">{title}</p>
        {text && <p className="max-w-sm text-sm text-(--sf-muted)">{text}</p>}
      </div>
      {action}
    </div>
  );
}
