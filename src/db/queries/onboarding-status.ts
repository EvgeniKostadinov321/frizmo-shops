import { and, count, eq } from "drizzle-orm";
import { db, paymentMethods, products, shippingMethods, type Shop } from "@/db";

export interface ChecklistStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
  /** Текст на действащия линк за недовършена стъпка („Добави“/„Публикувай“…). */
  cta: string;
}

export interface ChecklistResult {
  steps: ChecklistStep[];
  done: number;
  total: number;
  complete: boolean;
}

export interface ChecklistFlags {
  hasProduct: boolean;
  hasContacts: boolean;
  hasShipping: boolean;
  hasPayment: boolean;
  published: boolean;
}

/** Чиста логика: флагове → стъпки + прогрес. „Магазин създаден“ е винаги done тук. */
export function computeChecklist(f: ChecklistFlags): ChecklistResult {
  const steps: ChecklistStep[] = [
    { key: "shop", label: "Магазинът е създаден", done: true, href: "/dashboard/store", cta: "Провери" },
    { key: "product", label: "Добави първи продукт", done: f.hasProduct, href: "/dashboard/products/new", cta: "Добави" },
    { key: "contacts", label: "Попълни контакти и адрес", done: f.hasContacts, href: "/dashboard/store?tab=contacts", cta: "Попълни" },
    { key: "shipping", label: "Добави метод на доставка", done: f.hasShipping, href: "/dashboard/fulfillment?tab=shipping", cta: "Добави" },
    { key: "payment", label: "Добави метод на плащане", done: f.hasPayment, href: "/dashboard/fulfillment?tab=payment", cta: "Добави" },
    { key: "publish", label: "Публикувай магазина", done: f.published, href: "/dashboard/website", cta: "Публикувай" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length };
}

/** Онбординг статус от реални данни (евтини count-ове + полета на магазина). */
export async function getOnboardingStatus(shop: Shop): Promise<ChecklistResult> {
  const [[prod], [ship], [pay]] = await Promise.all([
    db.select({ c: count() }).from(products).where(eq(products.shopId, shop.id)),
    db
      .select({ c: count() })
      .from(shippingMethods)
      .where(and(eq(shippingMethods.shopId, shop.id), eq(shippingMethods.active, true))),
    db
      .select({ c: count() })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.shopId, shop.id), eq(paymentMethods.active, true))),
  ]);
  return computeChecklist({
    hasProduct: (prod?.c ?? 0) > 0,
    hasContacts: !!shop.phone && !!(shop.city || shop.address),
    hasShipping: (ship?.c ?? 0) > 0,
    hasPayment: (pay?.c ?? 0) > 0,
    published: shop.status === "published",
  });
}
