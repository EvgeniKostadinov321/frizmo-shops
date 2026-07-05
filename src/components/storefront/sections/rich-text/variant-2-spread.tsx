import { Paragraphs, SectionShell } from "../shared";
import type { RichTextVariantProps } from "./index";

/**
 * Вариант 2 — асиметричен spread: заглавието + hairline вляво (1/3, залепва
 * при скрол на дълъг текст), тялото вдясно (2/3) с водещ параграф. Журнална
 * асиметрия — обратното на центрирания вариант 1.
 */
export function RichTextSpread({ data, tone }: RichTextVariantProps) {
  const [lead, ...rest] = data.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-14">
        <div className="flex flex-col gap-4 md:sticky md:top-24 md:self-start">
          <span aria-hidden className="h-0.5 w-10 bg-(--sf-primary)" />
          {data.title && (
            <h2 className="text-balance text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
              {data.title}
            </h2>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {lead && (
            <p className="text-pretty text-xl leading-relaxed text-(--sf-text)">{lead}</p>
          )}
          {rest.length > 0 && (
            <div className="flex flex-col gap-4 text-lg leading-relaxed text-(--sf-muted)">
              <Paragraphs text={rest.join("\n\n")} />
            </div>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
