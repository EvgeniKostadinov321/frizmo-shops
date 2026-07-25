import { Icon } from "@/components/ui";

/*
 * Декоративни мини UI мокъпи за FEATURES bento секцията на landing-а.
 * Чист HTML/CSS с токени — остри в light и dark, не остаряват като скрийншоти.
 * Мокъпите са frame-less: сами запълват bento клетката си.
 */

/** Push известие „Нова поръчка" + ред от таблото. */
export function OrderNotificationMockup() {
  return (
    <div aria-hidden className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-start gap-3 rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-float">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-600 text-white">
          <Icon name="bell" size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-ink-900">Нова поръчка #0042</span>
          <span className="block truncate text-[11px] text-ink-500">
            2 × Краве сирене 1кг · 46,00 €
          </span>
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-ink-500">сега</span>
      </div>
      <div className="rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-card">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-ink-900">Мария П. · Пловдив</span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">Нова</span>
        </div>
        <div className="mt-2 flex gap-2">
          <span className="rounded-control bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white">
            Потвърди
          </span>
          <span className="rounded-control border border-surface-200 px-2.5 py-1 text-[10px] text-ink-700">
            Детайли
          </span>
        </div>
      </div>
    </div>
  );
}

/** Резултат в търсачка + карта от каталога — видимост. */
export function VisibilityMockup() {
  return (
    <div aria-hidden className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-3.5 py-2 shadow-card">
        <Icon name="search" size={14} className="text-ink-500" />
        <span className="text-[11px] text-ink-700">домашно сирене пловдив</span>
      </div>
      <div className="rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-float">
        <span className="block text-[10px] text-success-600">frizmoshops.bg › s › tvoyat-magazin</span>
        <span className="mt-0.5 block text-xs font-bold text-ink-900">
          Твоят магазин — домашни млечни продукти
        </span>
        <span className="mt-0.5 block text-[11px] text-ink-500">
          Поръчай онлайн: сирене, кашкавал и още от фермата…
        </span>
      </div>
    </div>
  );
}
