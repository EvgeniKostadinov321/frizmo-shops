import { Icon } from "@/components/ui";
import { SectionShell } from "../shared";
import type { FaqVariantProps } from "./index";

/**
 * Вариант 2 — spread: заглавието + hairline вляво (залепва при скрол),
 * въпросите вдясно като hairline редове (без карти-кутии) с „+", което се
 * завърта на „×" при отваряне. Журналната асиметрия от текстовия блок.
 */
export function FaqSpread({ data, tone }: FaqVariantProps) {
  const items = data.items.filter((i) => i.question.trim() && i.answer.trim());
  if (items.length === 0) return null;

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-14">
        <div className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
            Помощ
          </p>
          <h2 className="text-balance text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
            {data.title || "Често задавани въпроси"}
          </h2>
        </div>
        <div className="border-t border-(--sf-border)">
          {items.map((item, i) => (
            <details key={i} className="group border-b border-(--sf-border)">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-medium text-(--sf-text)">
                {item.question}
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center text-(--sf-primary) transition-transform duration-300 group-open:rotate-45"
                >
                  <Icon name="plus" size={20} />
                </span>
              </summary>
              <p className="whitespace-pre-line pb-5 leading-relaxed text-(--sf-muted)">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
