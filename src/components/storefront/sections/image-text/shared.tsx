import type { SectionOfType } from "@/schemas/site-settings";
import { Paragraphs } from "../shared";

export type ImageTextData = SectionOfType<"image-text">["data"];

/**
 * Editorial текстов блок: акцентна hairline + заглавие + водещ първи параграф
 * (по-едър, пълен цвят) + останалите в muted. Общ за двата варианта.
 */
export function ImageTextBody({ data }: { data: ImageTextData }) {
  const [lead, ...rest] = data.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-5">
      <span aria-hidden className="h-0.5 w-10 bg-(--sf-primary)" />
      {data.title && (
        <h2 className="text-balance text-[clamp(2rem,4vw,3rem)] leading-[1.08] text-(--sf-text)">
          {data.title}
        </h2>
      )}
      {lead && <p className="text-pretty text-xl leading-relaxed text-(--sf-text)">{lead}</p>}
      {rest.length > 0 && (
        <div className="flex flex-col gap-3 text-lg leading-relaxed text-(--sf-muted)">
          <Paragraphs text={rest.join("\n\n")} />
        </div>
      )}
    </div>
  );
}

/** Без снимка → центриран текстов блок (не полу-празен грид). Общ fallback. */
export function ImageTextCentered({ data }: { data: ImageTextData }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        {data.title && (
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
            {data.title}
          </h2>
        )}
        <div className="flex flex-col gap-3 text-lg leading-relaxed text-(--sf-muted)">
          <Paragraphs text={data.text} />
        </div>
      </div>
    </section>
  );
}
