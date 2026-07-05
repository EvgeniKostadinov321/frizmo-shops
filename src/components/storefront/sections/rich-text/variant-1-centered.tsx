import { Paragraphs, SectionShell } from "../shared";
import type { RichTextVariantProps } from "./index";

/** Вариант 1 — центриран editorial блок с drop cap. */
export function RichTextCentered({ data, tone }: RichTextVariantProps) {
  /* Editorial блок: центрирано заглавие с hairline, а тялото — списанийна
     лява колона с водещ параграф + DROP CAP (голяма начална буква в display
     шрифта на темата; серифните теми светват). Останалите параграфи — muted. */
  const [lead, ...rest] = data.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span aria-hidden className="h-0.5 w-10 bg-(--sf-primary)" />
          {data.title && (
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
              {data.title}
            </h2>
          )}
        </div>
        {lead && (
          <p className="text-pretty text-xl leading-relaxed text-(--sf-text) first-letter:float-left first-letter:mr-3 first-letter:mt-1.5 first-letter:font-(family-name:--sf-font-heading) first-letter:text-[3.4em] first-letter:leading-[0.75] first-letter:text-(--sf-primary) first-letter:font-(--sf-heading-weight)">
            {lead}
          </p>
        )}
        {rest.length > 0 && (
          <div className="mt-5 flex flex-col gap-4 text-lg leading-relaxed text-(--sf-muted)">
            <Paragraphs text={rest.join("\n\n")} />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
