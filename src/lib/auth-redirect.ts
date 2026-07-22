import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Дестинация след вход. Принцип: РОЛЯТА НА ТЕКУЩОТО ДЕЙСТВИЕ (chosenRole — от
 * контекста/toggle-а) определя посоката и НАДДЕЛЯВА над това дали акаунтът има
 * магазин (hasShop). Така dual-role собственик, влязъл през купувачки контекст
 * (профил икона в магазин, „Пазарувам" toggle), стига до /account, не /dashboard.
 *
 * Йерархия:
 *   1. chosenRole="seller" → /dashboard (явно; дори без магазин — онбординг там)
 *   2. chosenRole="buyer"  → валиден next | /account (ИГНОРИРА hasShop)
 *   3. няма явна роля → hasShop || preferredRole="seller" → /dashboard (fallback)
 *   4. иначе → валиден next | /account
 */
export function resolvePostAuthPath(
  hasShop: boolean,
  preferredRole: "buyer" | "seller" | null,
  next?: string,
  chosenRole?: "buyer" | "seller",
): string {
  const buyerDest = () => {
    const safe = safeNextPath(next);
    return safe !== "/dashboard" ? safe : "/account";
  };
  /* Явната роля на действието печели — контекстът определя ролята. */
  if (chosenRole === "seller") return "/dashboard";
  if (chosenRole === "buyer") return buyerDest();
  /* Без явна роля → пада на състоянието на акаунта (стар register път, „гол" login). */
  if (hasShop || preferredRole === "seller") return "/dashboard";
  return buyerDest();
}
