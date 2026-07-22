import { cmToMm, toCents, toMilliQuantity } from "@/lib/money";
import { sanitizeMultiline, sanitizeText } from "@/lib/sanitize";
import type { ProductInput } from "@/schemas/product";

/** Мапва валидиран ProductInput към колоните на таблицата products. Чиста функция. */
export function productValues(input: ProductInput, shopId: string) {
  return {
    shopId,
    categoryId: input.categoryId || null,
    name: sanitizeText(input.name, 120),
    description: sanitizeMultiline(input.description, 10_000),
    priceCents: toCents(input.price)!,
    promoPriceCents: input.promoPrice ? toCents(input.promoPrice) : null,
    stock: input.stock === "" ? null : input.stock,
    status: input.status,
    images: input.images,
    weightGrams: input.weight === "" ? null : input.weight,
    lengthMm: input.length === "" ? null : cmToMm(input.length),
    widthMm: input.width === "" ? null : cmToMm(input.width),
    heightMm: input.height === "" ? null : cmToMm(input.height),
    netQuantityValue: input.netQuantity ? toMilliQuantity(input.netQuantity.value)! : null,
    netQuantityUnit: input.netQuantity ? input.netQuantity.unit : null,
    sku: input.sku ? sanitizeText(input.sku, 60) : null,
    gtin: input.gtin || null,
    brand: input.brand ? sanitizeText(input.brand, 60) : null,
    costCents: input.cost ? toCents(input.cost) : null,
    seoTitle: input.seoTitle ? sanitizeText(input.seoTitle, 60) : null,
    seoDescription: input.seoDescription ? sanitizeText(input.seoDescription, 160) : null,
    sizeGuideId: input.sizeGuideId || null,
    /* Ръчна изработка: срокът/таванът важат само когато е включена (иначе null). */
    madeToOrder: input.madeToOrder,
    leadDaysMin: input.madeToOrder && input.leadDaysMin !== "" ? input.leadDaysMin : null,
    leadDaysMax: input.madeToOrder && input.leadDaysMax !== "" ? input.leadDaysMax : null,
    madeToOrderCap:
      input.madeToOrder && input.madeToOrderCap !== "" ? input.madeToOrderCap : null,
    updatedAt: new Date(),
  };
}
