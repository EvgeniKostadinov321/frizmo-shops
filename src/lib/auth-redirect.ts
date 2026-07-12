import { safeNextPath } from "@/lib/safe-redirect";

/** Дестинация след вход: магазин или продавач → dashboard; купувач → account или валиден next. */
export function resolvePostAuthPath(
  hasShop: boolean,
  preferredRole: "buyer" | "seller" | null,
  next?: string,
): string {
  if (hasShop || preferredRole === "seller") return "/dashboard";
  const safe = safeNextPath(next);
  return safe !== "/dashboard" ? safe : "/account";
}
