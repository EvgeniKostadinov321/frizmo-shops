import Link from "next/link";
import { Icon } from "@/components/ui";
import type { ChecklistResult } from "@/db/queries/onboarding-status";

/**
 * Д1: начален чеклист на dashboard. Показва прогреса към жив магазин; всеки ред
 * с линк към недовършеното. Ако всичко е готово → не се рендерира (магазинът е „порасъл").
 */
export function OnboardingChecklist({ result }: { result: ChecklistResult }) {
  if (result.complete) return null;

  const pct = Math.round((result.done / result.total) * 100);

  return (
    <section className="rounded-card border border-surface-200 bg-surface-0 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink-900">Настрой магазина</h2>
        <span className="text-sm tabular-nums text-ink-500">
          {result.done}/{result.total} готови
        </span>
      </div>

      {/* Прогрес бар */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {result.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                step.done ? "bg-success-600 text-surface-0" : "border-2 border-surface-300"
              }`}
            >
              {step.done && <Icon name="check" size={14} className="stroke-3" />}
            </span>
            <span className={`flex-1 text-sm ${step.done ? "text-ink-500 line-through" : "text-ink-900"}`}>
              {step.label}
            </span>
            {!step.done && (
              <Link href={step.href} className="text-sm font-medium text-brand-600 hover:underline">
                Добави
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
