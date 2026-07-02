import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";

export function FaqSection({ data }: { data: SectionOfType<"faq">["data"] }) {
  const items = data.items.filter((i) => i.question.trim() && i.answer.trim());
  if (items.length === 0) return null;

  return (
    <SectionShell title={data.title || "Често задавани въпроси"}>
      <div className="flex max-w-3xl flex-col gap-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-4 py-3"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-medium text-(--sf-text)">
              {item.question}
              <span aria-hidden className="text-(--sf-muted) transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="whitespace-pre-line pb-2 pt-1 text-sm text-(--sf-muted)">{item.answer}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}
