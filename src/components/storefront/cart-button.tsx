"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getCartSnapshot, getServerCartSnapshot, onCartChange } from "@/lib/cart-storage";

export function CartButton({ shopId, base }: { shopId: string; base: string }) {
  const lines = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <Link
      href={`${base}/cart`}
      aria-label={`Количка (${count} артикула)`}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-xl transition-opacity hover:opacity-70"
    >
      🛒
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-(--sf-primary) px-1 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
