"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteShop } from "@/actions/buyer";
import { Icon } from "@/components/ui";

/**
 * Сърце „любим магазин" за каталог картата (платформени токени). Живее вътре в
 * <Link> — гаси навигацията. Логнат → toggle в акаунта (оптимистично); гост →
 * към вход. Позиционира се абсолютно от родителя.
 */
export function ShopFavoriteHeart({
  shopId,
  initialFavorited,
  loggedIn,
}: {
  shopId: string;
  initialFavorited: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label={fav ? "Премахни от любими магазини" : "Добави в любими магазини"}
      aria-pressed={fav}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loggedIn) {
          router.push("/auth/login?role=buyer&next=/account");
          return;
        }
        setBusy(true);
        const next = !fav;
        setFav(next);
        const res = await toggleFavoriteShop(shopId);
        if (!res.ok) setFav(!next);
        setBusy(false);
      }}
      className="flex size-9 items-center justify-center rounded-full bg-surface-0/90 text-ink-700 shadow-sm backdrop-blur transition-colors hover:text-danger-600"
    >
      <Icon name="heart" size={18} className={fav ? "fill-current text-danger-600" : ""} />
    </button>
  );
}
