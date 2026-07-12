import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Дестинация след вход: магазин или продавач → dashboard; купувач → валиден next
 * (обикновено профилът на магазина, откъдето е дошъл). Профилът на купувача живее
 * под /s/{slug}/account (per-магазин), затова БЕЗ next купувачът отива в каталога
 * /shops — няма самостоятелно „/account" извън контекста на магазин.
 */
export function resolvePostAuthPath(
  hasShop: boolean,
  preferredRole: "buyer" | "seller" | null,
  next?: string,
): string {
  if (hasShop || preferredRole === "seller") return "/dashboard";
  const safe = safeNextPath(next);
  return safe !== "/dashboard" ? safe : "/shops";
}
