import type { SectionOfType } from "@/schemas/site-settings";
import { Paragraphs, SectionShell, type SectionTone } from "./shared";

export function RichTextSection({
  data,
  tone,
}: {
  data: SectionOfType<"rich-text">["data"];
  tone?: SectionTone;
}) {
  if (!data.text) return null;
  /* Центриран editorial блок: заглавие + четима колона в средата вместо тясна
     лява колона с празно вдясно. Дава йерархия и баланс (проблем „За нас"). */
  return (
    <SectionShell tone={tone} titleHidden>
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
    </SectionShell>
  );
}
