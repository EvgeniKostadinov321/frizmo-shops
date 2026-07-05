"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";
import { openCartDrawer } from "@/components/storefront/cart-drawer";
import { getCartSnapshot, getServerCartSnapshot, onCartChange } from "@/lib/cart-storage";

/** Количката в header-а: отваря mini-cart drawer-а (страницата /cart остава
 *  достъпна по директен линк). Баджът е жив през cart storage събитията. */
export function CartButton({ shopId }: { shopId: string; base?: string }) {
  const lines = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <button
      type="button"
      onClick={openCartDrawer}
      aria-label={`Количка (${count} артикула)`}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="shopping-cart" size={22} />
      {count > 0 && (
        /* Вътре в 44px кутията — иначе nav overflow-x-auto показва scrollbar */
        <span className="absolute right-0 top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-(--sf-primary) px-1 text-[10px] font-bold leading-4 text-(--sf-on-primary)">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
