import { Icon } from "@/components/ui";

/** Коя мини-визуализация да се покаже вдясно на стъпката. */
export type StepVisual = "register" | "products" | "theme" | "publish";

type StepRowProps = {
  number: string;
  title: string;
  text: string;
  visual: StepVisual;
  /** Последната стъпка не рисува свързваща линия надолу. */
  isLast?: boolean;
};

/** Стъпка 1 — форма за регистрация на магазина. */
function RegisterVisual() {
  return (
    <div aria-hidden className="flex w-full max-w-[15rem] flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2">
        <span className="text-[9px] font-medium text-ink-500">Име на магазина</span>
        <span className="text-[11px] font-semibold text-ink-900">Ателие Ръчичка</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-medium text-brand-700">
          Ръчна изработка
        </span>
      </div>
    </div>
  );
}

/** Стъпка 2 — продуктова карта с полета. */
function ProductsVisual() {
  return (
    <div aria-hidden className="flex w-full max-w-[15rem] items-center gap-3 rounded-lg border border-surface-200 bg-surface-0 p-2.5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-100 text-brand-600">
        <Icon name="image" size={18} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="h-2 w-3/4 rounded-full bg-surface-200" />
        <span className="mt-0.5 text-[11px] font-bold text-ink-900">34,00 €</span>
      </div>
      <span className="rounded-full bg-brand-600 px-2 py-1 text-[9px] font-bold text-white">
        Запази
      </span>
    </div>
  );
}

/** Стъпка 3 — цветови swatch-ове (избор на визия). */
function ThemeVisual() {
  const swatches = ["bg-brand-600", "bg-ember-500", "bg-ink-900", "bg-brand-100"];
  return (
    <div aria-hidden className="flex w-full max-w-[15rem] flex-col gap-2 rounded-lg border border-surface-200 bg-surface-0 p-3">
      <span className="text-[9px] font-medium text-ink-500">Цвят на магазина</span>
      <div className="flex gap-2">
        {swatches.map((c, i) => (
          <span
            key={c}
            className={`size-6 rounded-full ${c} ${i === 0 ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface-0" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Стъпка 4 — toggle „на живо" + споделен линк. */
function PublishVisual() {
  return (
    <div aria-hidden className="flex w-full max-w-[15rem] flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-0 px-3 py-2">
        <span className="text-[11px] font-semibold text-ink-900">Магазинът е на живо</span>
        <span className="flex h-4 w-7 items-center rounded-full bg-brand-600 px-0.5">
          <span className="ml-auto size-3 rounded-full bg-white" />
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-[10px] text-ink-700">
        <Icon name="store" size={11} className="text-brand-600" />
        frizmo.shop/s/atelie-rachichka
      </div>
    </div>
  );
}

const VISUALS: Record<StepVisual, () => React.ReactElement> = {
  register: RegisterVisual,
  products: ProductsVisual,
  theme: ThemeVisual,
  publish: PublishVisual,
};

/**
 * Ред-стъпка за „Как работи": номер със свързваща линия за прогрес,
 * заглавие/текст и мини CSS визуализация на съответния екран.
 */
export function StepRow({ number, title, text, visual, isLast = false }: StepRowProps) {
  const Visual = VISUALS[visual];
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 sm:grid-cols-[2.5rem_1fr_auto] sm:items-center">
      {/* Номер + вертикална свързваща линия */}
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-base font-extrabold text-white">
          {number}
        </span>
        {!isLast && <span aria-hidden className="w-px flex-1 bg-surface-200" />}
      </div>

      {/* Текст */}
      <div className={isLast ? "" : "pb-8"}>
        <h3 className="text-lg font-bold text-ink-900">{title}</h3>
        <p className="mt-1 leading-relaxed text-ink-700">{text}</p>
      </div>

      {/* Мини визуализация — под текста на mobile, вдясно на desktop */}
      <div className={`col-start-2 sm:col-start-3 sm:row-start-1 ${isLast ? "" : "pb-8"}`}>
        <Visual />
      </div>
    </div>
  );
}
