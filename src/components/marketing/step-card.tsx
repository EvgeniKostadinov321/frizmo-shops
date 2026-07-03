import { Icon } from "@/components/ui";

/** Коя мини-визуализация да се покаже в екранчето на картата. */
export type StepVisual = "register" | "products" | "theme" | "publish";

type StepCardProps = {
  number: string;
  title: string;
  text: string;
  visual: StepVisual;
};

/** Стъпка 1 — форма за регистрация на магазина. */
function RegisterVisual() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2">
        <span className="text-[9px] font-medium text-ink-500">Име на магазина</span>
        <span className="text-[11px] font-semibold text-ink-900">Ателие Ръчичка</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2.5">
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
    <div aria-hidden className="flex w-full items-center gap-3 rounded-lg border border-surface-200 bg-surface-0 p-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-100 text-brand-600">
        <Icon name="image" size={20} />
      </span>
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="h-2 w-3/4 rounded-full bg-surface-200" />
        <span className="text-[12px] font-bold text-ink-900">34,00 €</span>
      </div>
      <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[9px] font-bold text-white">
        Запази
      </span>
    </div>
  );
}

/** Стъпка 3 — цветови swatch-ове (избор на визия). */
function ThemeVisual() {
  const swatches = ["bg-brand-600", "bg-ember-500", "bg-ink-900", "bg-brand-100"];
  return (
    <div aria-hidden className="flex w-full flex-col gap-2.5 rounded-lg border border-surface-200 bg-surface-0 p-3">
      <span className="text-[9px] font-medium text-ink-500">Цвят на магазина</span>
      <div className="flex gap-2.5">
        {swatches.map((c, i) => (
          <span
            key={c}
            className={`size-7 rounded-full ${c} ${i === 0 ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-surface-0" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Стъпка 4 — toggle „на живо" + споделен линк. */
function PublishVisual() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-0 px-3 py-2.5">
        <span className="text-[11px] font-semibold text-ink-900">Магазинът е на живо</span>
        <span className="flex h-4 w-7 items-center rounded-full bg-brand-600 px-0.5">
          <span className="ml-auto size-3 rounded-full bg-white" />
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-[10px] text-ink-700">
        <Icon name="store" size={11} className="shrink-0 text-brand-600" />
        <span className="truncate">frizmo.shop/s/atelie-rachichka</span>
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
 * Карта-стъпка за „Как работи": номер + заглавие + текст отгоре, мини CSS
 * визуализация на съответния екран в екранче с фиксирана височина (симетрия).
 */
export function StepCard({ number, title, text, visual }: StepCardProps) {
  const Visual = VISUALS[visual];
  return (
    <div className="group flex h-full flex-col rounded-card border border-surface-200 bg-surface-0 p-5 shadow-card transition-all hover:-translate-y-1 hover:border-surface-300 hover:shadow-float">
      <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-extrabold text-white">
        {number}
      </span>
      <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-700">{text}</p>
      <div className="mt-5 flex h-28 items-center rounded-xl bg-surface-50 p-3">
        <Visual />
      </div>
    </div>
  );
}
