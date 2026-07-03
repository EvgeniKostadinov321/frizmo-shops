const STEPS = ["Магазин", "Първи продукт"] as const;

/**
 * Editorial стъпков индикатор за onboarding („Пазарен ден"): номерирани
 * кръгове, свързани с hairline; активната стъпка е brand, минатите — с чек.
 * Само токени → работи light + dark.
 */
export function OnboardingProgress({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-3" aria-label="Стъпки за създаване">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors ${
                active
                  ? "bg-brand-500 text-surface-0"
                  : done
                    ? "bg-brand-100 text-brand-700"
                    : "border border-surface-300 bg-surface-0 text-ink-500"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                n
              )}
            </span>
            <span
              className={`text-sm font-medium ${active ? "text-ink-900" : "text-ink-500"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-8 bg-surface-300 sm:w-12" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
