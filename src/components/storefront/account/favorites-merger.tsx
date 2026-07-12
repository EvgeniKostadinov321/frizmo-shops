"use client";

import { useEffect } from "react";
import { mergeFavoritesOnLogin } from "@/actions/buyer";
import { readFavorites } from "@/lib/favorites-storage";

/**
 * S3: при първо зареждане на логнат купувач влива localStorage любимите в акаунта
 * му, после ги чисти локално. Изпълнява се веднъж на сесия (sessionStorage guard),
 * за да не праща заявка на всяко навигиране. Рендерира се само за логнати.
 */
export function FavoritesMerger({ shopId }: { shopId: string }) {
  useEffect(() => {
    const flag = `frizmo-fav-merged-${shopId}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
    const localIds = readFavorites(shopId);
    if (localIds.length === 0) return;
    void mergeFavoritesOnLogin(localIds).then((res) => {
      if (res.ok) window.localStorage.removeItem(`frizmo-favorites-${shopId}`);
    });
  }, [shopId]);

  return null;
}
