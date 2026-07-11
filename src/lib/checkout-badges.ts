import type { IconName } from "@/components/ui";

export interface CheckoutBadge {
  icon: IconName;
  text: string;
}

/**
 * Авто trust badges за checkout — деривирани от реални данни (без конфигурация).
 * Ред: плащане при доставка (ако COD) → връщане (ако има срок) → сигурна поръчка
 * → без регистрация (последните две са винаги).
 */
export function buildCheckoutBadges(returnWindowDays: number, hasCod: boolean): CheckoutBadge[] {
  const badges: CheckoutBadge[] = [];
  if (hasCod) badges.push({ icon: "truck", text: "Плащане при доставка" });
  if (returnWindowDays > 0) {
    badges.push({ icon: "return", text: `Връщане до ${returnWindowDays} дни` });
  }
  badges.push({ icon: "shield-check", text: "Сигурна поръчка" });
  badges.push({ icon: "check", text: "Без регистрация" });
  return badges;
}
