"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteShop } from "@/actions/buyer";
import { Icon } from "@/components/ui";

/** Сърце „любим магазин" в storefront хедъра. Логнат → toggle (оптимистично);
    гост → към вход. Чете само currentColor + --sf-radius (темата на магазина). */
export function ShopFavoriteButton({
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
      onClick={async () => {
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
      className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="heart" size={22} className={fav ? "fill-current" : ""} />
    </button>
  );
}
