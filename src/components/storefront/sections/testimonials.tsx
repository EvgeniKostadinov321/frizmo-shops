import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";

export function TestimonialsSection({ data }: { data: SectionOfType<"testimonials">["data"] }) {
  const items = data.items.filter((i) => i.text.trim());
  if (items.length === 0) return null;

  return (
    <SectionShell title={data.title || "Какво казват клиентите"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <figure
            key={i}
            className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-5"
          >
            <blockquote className="text-sm text-(--sf-text)">„{item.text}“</blockquote>
            {item.name && (
              <figcaption className="mt-auto text-sm font-medium text-(--sf-muted)">
                — {item.name}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}
