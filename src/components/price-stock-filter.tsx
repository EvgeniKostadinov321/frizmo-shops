/**
 * Ценови диапазон + „В наличност" филтър — server component, без JS.
 * Рендерира ПОЛЕТА (не форма) — слага се вътре в GET формата на листинга, за да
 * се submit-ва заедно с останалите филтри. URL: ?min=&max=&inStock=1 (EUR, текст;
 * сървърът парсва с toCents и игнорира невалидни стойности).
 *
 * Два визуални варианта: "catalog" (платформени токени) и "storefront" (--sf-* vars).
 * `stacked` подрежда „В наличност" на нов ред (за тесни контейнери — drawer).
 */

interface PriceStockFilterProps {
  defaultMin?: string;
  defaultMax?: string;
  defaultInStock?: boolean;
  variant: "catalog" | "storefront";
  /** true → цените на ред, „В наличност" отдолу (за тесен drawer). */
  stacked?: boolean;
}

const STYLES = {
  catalog: {
    input:
      "h-11 min-w-0 rounded-control border border-surface-200 bg-surface-0 px-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none",
    label: "text-sm text-ink-700",
    dash: "text-ink-500",
    /* Custom checkbox кутия: празна → рамка; peer-checked → плътен brand + бял чек. */
    box: "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-surface-300 bg-surface-0 text-surface-0 transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
  },
  storefront: {
    input:
      "h-11 min-w-0 rounded-full border border-(--sf-border) bg-(--sf-surface-raised) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none",
    label: "text-sm text-(--sf-text)",
    dash: "text-(--sf-muted)",
    box: "flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-on-primary) transition-colors peer-checked:border-(--sf-primary) peer-checked:bg-(--sf-primary) [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--sf-primary)",
  },
} as const;

export function PriceStockFilter({
  defaultMin,
  defaultMax,
  defaultInStock,
  variant,
  stacked = false,
}: PriceStockFilterProps) {
  const s = STYLES[variant];

  const priceRow = (
    <div className="flex items-center gap-2">
      <span className={`shrink-0 ${s.label}`}>Цена</span>
      <input
        type="text"
        inputMode="decimal"
        name="min"
        defaultValue={defaultMin}
        placeholder="от €"
        aria-label="Минимална цена в евро"
        className={`${s.input} ${stacked ? "flex-1" : "w-20"}`}
      />
      <span aria-hidden className={s.dash}>
        –
      </span>
      <input
        type="text"
        inputMode="decimal"
        name="max"
        defaultValue={defaultMax}
        placeholder="до €"
        aria-label="Максимална цена в евро"
        className={`${s.input} ${stacked ? "flex-1" : "w-20"}`}
      />
    </div>
  );

  const inStockLabel = (
    <label className={`flex h-11 cursor-pointer items-center gap-2 ${s.label}`}>
      {/* Custom checkbox (CSS-only, за да пасва на всяка тема) — реалният input
          е скрит peer, кутията се рисува от нас с токените на варианта. */}
      <input
        type="checkbox"
        name="inStock"
        value="1"
        defaultChecked={defaultInStock}
        className="peer sr-only"
      />
      <span aria-hidden className={s.box}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      В наличност
    </label>
  );

  /* stacked (drawer): цена на ред, „В наличност" отдолу. inline (десктоп):
     всичко на един ред. */
  return stacked ? (
    <div className="flex flex-col gap-3">
      {priceRow}
      {inStockLabel}
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-3">
      {priceRow}
      {inStockLabel}
    </div>
  );
}
