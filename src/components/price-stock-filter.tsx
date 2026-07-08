/**
 * Ценови диапазон + „В наличност" филтър — server component, без JS.
 * Рендерира ПОЛЕТА (не форма) — слага се вътре в GET формата на листинга, за да
 * се submit-ва заедно с останалите филтри. URL: ?min=&max=&inStock=1 (EUR, текст;
 * сървърът парсва с toCents и игнорира невалидни стойности).
 *
 * Два визуални варианта: "catalog" (платформени токени) и "storefront" (--sf-* vars).
 */

interface PriceStockFilterProps {
  defaultMin?: string;
  defaultMax?: string;
  defaultInStock?: boolean;
  variant: "catalog" | "storefront";
}

const STYLES = {
  catalog: {
    input:
      "h-11 w-24 rounded-control border border-surface-200 bg-surface-0 px-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none",
    label: "text-sm text-ink-700",
    check: "size-4 accent-brand-600",
  },
  storefront: {
    input:
      "h-11 w-24 rounded-full border border-(--sf-border) bg-(--sf-surface-raised) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none",
    label: "text-sm text-(--sf-text)",
    check: "size-4 accent-(--sf-primary)",
  },
} as const;

export function PriceStockFilter({
  defaultMin,
  defaultMax,
  defaultInStock,
  variant,
}: PriceStockFilterProps) {
  const s = STYLES[variant];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={s.label}>Цена</span>
      <input
        type="text"
        inputMode="decimal"
        name="min"
        defaultValue={defaultMin}
        placeholder="от €"
        aria-label="Минимална цена в евро"
        className={s.input}
      />
      <span aria-hidden className={s.label}>
        –
      </span>
      <input
        type="text"
        inputMode="decimal"
        name="max"
        defaultValue={defaultMax}
        placeholder="до €"
        aria-label="Максимална цена в евро"
        className={s.input}
      />
      <label className={`flex h-11 cursor-pointer items-center gap-2 ${s.label}`}>
        <input
          type="checkbox"
          name="inStock"
          value="1"
          defaultChecked={defaultInStock}
          className={s.check}
        />
        В наличност
      </label>
    </div>
  );
}
