import type { ReactNode } from "react";

/**
 * Editorial заглавен блок за вътрешните страници на магазина („Продукти",
 * „Количка", „За нас"…) — kicker + display h1 + hairline. Дава на вътрешните
 * страници същия ритъм като секциите на началната; целият вид идва от
 * --sf-* токените (шрифт/тежест през глобалното [data-storefront] правило).
 */
export function PageHeader({
  kicker,
  title,
  intro,
  action,
}: {
  /** Малка uppercase дума над заглавието (напр. „Магазин", „Поръчка"). */
  kicker: string;
  title: string;
  /** Кратък ред под заглавието (напр. брой резултати). */
  intro?: ReactNode;
  /** Действие вдясно от заглавието (напр. линк „← Продължи пазаруването"). */
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-(--sf-border) pb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
            {kicker}
          </p>
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05] text-(--sf-text)">
            {title}
          </h1>
          {intro && <p className="mt-2 text-sm text-(--sf-muted)">{intro}</p>}
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
    </header>
  );
}
