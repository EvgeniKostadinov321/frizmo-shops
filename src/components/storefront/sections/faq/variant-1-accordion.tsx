import { SectionShell } from "../shared";
import type { FaqVariantProps } from "./index";

/** Вариант 1 — центриран акордеон с карти. */
export function FaqAccordion({ data, tone }: FaqVariantProps) {
  const items = data.items.filter((i) => i.question.trim() && i.answer.trim());
  if (items.length === 0) return null;

  /* Центрирана колона — балансирано, четимо, без празна дясна половина. */
  return (
    <SectionShell kicker="Помощ" title={data.title || "Често задавани въпроси"} tone={tone} titleHidden>
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
            Помощ
          </p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
            {data.title || "Често задавани въпроси"}
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <details
              key={i}
              className="group rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-5 py-4 shadow-(--sf-shadow)"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-(--sf-text)">
                {item.question}
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-(--sf-border) text-(--sf-muted) transition-transform duration-300 group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <p className="whitespace-pre-line pb-2 pt-3 leading-relaxed text-(--sf-muted)">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
