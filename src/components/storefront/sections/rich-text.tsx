import type { SectionOfType } from "@/schemas/site-settings";
import { Paragraphs, SectionShell } from "./shared";

export function RichTextSection({ data }: { data: SectionOfType<"rich-text">["data"] }) {
  if (!data.text) return null;
  return (
    <SectionShell title={data.title}>
      <div className="flex max-w-prose flex-col gap-3 text-(--sf-muted)">
        <Paragraphs text={data.text} />
      </div>
    </SectionShell>
  );
}
