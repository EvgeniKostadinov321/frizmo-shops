import { Icon } from "@/components/ui";

/*
 * Декоративни мини UI мокъпи за FEATURES секцията на landing-а.
 * Чист HTML/CSS с токени — остри в light и dark, не остаряват като скрийншоти.
 */

function MockupFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-64 items-center justify-center rounded-card border border-surface-200 bg-surface-100/70 p-6"
    >
      {children}
    </div>
  );
}

/** Панел „тема редактор": цветови swatch-ове + подреждаеми секции. */
export function ThemeEditorMockup() {
  return (
    <MockupFrame>
      <div className="w-full max-w-xs rounded-card border border-surface-200 bg-surface-0 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-ink-900">Дизайн на магазина</span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
            Live preview
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="size-6 rounded-full bg-brand-600 ring-2 ring-brand-600 ring-offset-2 ring-offset-surface-0" />
          <span className="size-6 rounded-full bg-warning-600/80" />
          <span className="size-6 rounded-full bg-danger-600/70" />
          <span className="size-6 rounded-full bg-ink-700" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {["Hero банер", "Продукти", "За нас", "Отзиви"].map((label) => (
            <span
              key={label}
              className="flex items-center gap-2 rounded-control border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-[11px] text-ink-700"
            >
              <span className="text-ink-500">⠿</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

/** Push известие „Нова поръчка" + ред от таблото. */
export function OrderNotificationMockup() {
  return (
    <MockupFrame>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <div className="flex items-start gap-3 rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-lg">
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
        <div className="rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-ink-900">Мария П. · Пловдив</span>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
              Нова
            </span>
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
    </MockupFrame>
  );
}

/** Резултат в търсачка + карта от каталога — видимост. */
export function VisibilityMockup() {
  return (
    <MockupFrame>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <div className="flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-3.5 py-2 shadow-sm">
          <Icon name="search" size={14} className="text-ink-500" />
          <span className="text-[11px] text-ink-700">домашно сирене пловдив</span>
        </div>
        <div className="rounded-card border border-surface-200 bg-surface-0 p-3.5 shadow-lg">
          <span className="block text-[10px] text-success-600">frizmoshops.bg › s › tvoyat-magazin</span>
          <span className="mt-0.5 block text-xs font-bold text-ink-900">
            Твоят магазин — домашни млечни продукти
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-500">
            Поръчай онлайн: сирене, кашкавал и още от фермата…
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-card border border-surface-200 bg-surface-0 p-3 shadow-sm">
          <span className="flex size-8 items-center justify-center rounded-control bg-brand-100 text-brand-700">
            <Icon name="store" size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-ink-900">В каталога на Frizmo Shops</span>
            <span className="block text-[10px] text-ink-500">Храни и напитки · Пловдив</span>
          </span>
        </div>
      </div>
    </MockupFrame>
  );
}
