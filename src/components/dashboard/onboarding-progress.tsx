const STEPS = ["Магазин", "Първи продукт"] as const;

/**
 * Общ прогрес на onboarding-а като тънка лента („докъде си в целия процес").
 * Йерархия: тази лента е за макро-прогреса (магазин → продукт), а детайлните
 * под-стъпки на магазина имат свой номериран индикатор в `ShopWizard`.
 * Само токени → работи light + dark.
 */
export function OnboardingProgress({ step }: { step: 1 | 2 }) {
  const total = STEPS.length;
  const pct = Math.round((step / total) * 100);
  const label = STEPS[step - 1];

  return (
    <div aria-label={`Стъпка ${step} от ${total}: ${label}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          Стъпка {step} от {total}
          <span className="ml-2 text-ink-700">· {label}</span>
        </p>
        <span className="text-[11px] font-bold text-brand-600 tabular-nums">{pct}%</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
