import type { ShippingMethod } from "@/db";
import { Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { deliveryHoursLines } from "@/lib/working-hours";

/** Компактен блок „Доставка" на продуктовата страница — методи, цена, срок. */
export function ProductDelivery({ methods }: { methods: ShippingMethod[] }) {
  if (methods.length === 0) return null;
  return (
    <div className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-(--sf-primary)">
          <Icon name="truck" size={18} />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-(--sf-text)">Доставка</h2>
      </div>
      <ul className="flex flex-col divide-y divide-(--sf-border)">
        {methods.map((m) => {
          const lines = deliveryHoursLines(m.deliveryHours);
          return (
            <li key={m.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-(--sf-text)">{m.name}</span>
                <span className="shrink-0 text-sm text-(--sf-text)">
                  {m.priceCents === 0 ? "Безплатна" : formatPrice(m.priceCents)}
                </span>
              </div>
              {m.freeOverCents !== null && m.freeOverCents > 0 && m.priceCents > 0 && (
                <span className="text-xs text-(--sf-muted)">
                  Безплатна над {formatPrice(m.freeOverCents)}
                </span>
              )}
              {lines.map((line) => (
                <span key={line} className="text-xs text-(--sf-muted)">
                  {line}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
