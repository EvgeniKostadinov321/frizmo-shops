import Image from "next/image";
import { Icon } from "@/components/ui";

/** Коя мини-визуализация да се покаже в екранчето на картата. */
export type StepVisual = "register" | "products" | "theme" | "publish";

type StepCardProps = {
  number: string;
  title: string;
  text: string;
  visual: StepVisual;
};

/** Стъпка 1 — формата за регистрация: изписано име с мигащ курсор + избрана категория. */
function RegisterVisual() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg border border-brand-600/40 bg-surface-0 px-3 py-2 shadow-sm">
        <span className="text-[9px] font-medium text-ink-500">Име на магазина</span>
        <span className="flex items-center text-[11px] font-semibold text-ink-900">
          Ателие Ръчичка
          <span className="ml-0.5 h-3 w-px animate-pulse bg-brand-600" />
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-brand-100 px-2 py-1 text-[9px] font-semibold text-brand-700">
          <Icon name="check" size={9} />
          Ръчна изработка
        </span>
        <span className="rounded-full border border-dashed border-surface-300 px-2 py-1 text-[9px] font-medium text-ink-500">
          Козметика
        </span>
      </div>
    </div>
  );
}

/** Стъпка 2 — продуктова карта с РЕАЛНА снимка (showcase асета от hero-то). */
function ProductsVisual() {
  return (
    <div aria-hidden className="flex w-full items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-0 p-2.5 shadow-sm">
      <Image
        src="/landing/hero-mug.webp"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-md object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[11px] font-semibold text-ink-900">Керамична чаша „Есен“</span>
        <span className="text-[12px] font-bold text-ink-900">34,00 €</span>
      </div>
      <span className="shrink-0 rounded-full bg-brand-600 px-2.5 py-1 text-[9px] font-bold text-white">
        Запази
      </span>
    </div>
  );
}

/**
 * Стъпка 3 — тема preview + swatch-ове: при hover на картата „избираш" тъмната
 * палитра — пръстенът се мести и preview лентата се преоцветява. Разказ без думи.
 */
function ThemeVisual() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-2.5 rounded-lg border border-surface-200 bg-surface-0 p-3 shadow-sm">
      {/* Мини header на магазина — цветът следва „избраната" палитра */}
      <div className="flex h-6 items-center justify-between rounded-md bg-brand-600 px-2 transition-colors duration-500 group-hover:bg-ink-900">
        <span className="h-1.5 w-10 rounded-full bg-white/70" />
        <span className="size-2.5 rounded-full bg-white/40" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="size-6 rounded-full bg-brand-600 ring-2 ring-brand-600 ring-offset-2 ring-offset-surface-0 transition-shadow duration-300 group-hover:ring-transparent" />
        <span className="size-6 rounded-full bg-ember-500" />
        <span className="size-6 rounded-full bg-ink-900 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-ink-900 group-hover:ring-offset-2 group-hover:ring-offset-surface-0" />
        <span className="size-6 rounded-full bg-brand-100" />
        <span className="ml-auto text-[9px] font-medium text-ink-500">Пробвай ↗</span>
      </div>
    </div>
  );
}

/** Стъпка 4 — hover „публикува": toggle-ът се включва, „Чернова" става „На живо". */
function PublishVisual() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-0 px-3 py-2.5 shadow-sm">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-900">
          <span className="size-1.5 rounded-full bg-surface-300 transition-colors duration-300 group-hover:animate-pulse group-hover:bg-success-600" />
          <span className="group-hover:hidden">Чернова</span>
          <span className="hidden group-hover:inline">Магазинът е на живо</span>
        </span>
        <span className="flex h-4 w-7 items-center rounded-full bg-surface-300 px-0.5 transition-colors duration-300 group-hover:bg-brand-600">
          <span className="size-3 rounded-full bg-white transition-transform duration-300 group-hover:translate-x-3" />
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-[10px] text-ink-700">
        <Icon name="store" size={11} className="shrink-0 text-brand-600" />
        <span className="truncate">frizmoshops.bg/s/atelie-rachichka</span>
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
 * Карта-стъпка за „Как работи": номер + заглавие + текст отгоре, жива мини
 * визуализация в екранче с фиксирана височина (симетрия). Hover на картата
 * задвижва разказа във визуализацията (тема се сменя, магазин се публикува).
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
