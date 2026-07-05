import { SectionShell } from "../shared";
import { Stars, type TestimonialsVariantProps } from "./index";

/**
 * Вариант 2 — светли карти: отзиви върху нормалния фон (за търговци, които не
 * искат тъмната лента). Всяка карта: кръгче-инициал в primary, име + звезди,
 * цитатът отдолу. Тих и приветлив — обратното на инверсията.
 */
export function TestimonialsCards({ data }: TestimonialsVariantProps) {
  const items = data.items.filter((i) => i.text.trim());
  if (items.length === 0) return null;

  const cols =
    items.length === 1
      ? "max-w-xl mx-auto"
      : items.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <SectionShell kicker="Отзиви" title={data.title || "Какво казват клиентите"}>
      <div className={`grid gap-4 ${cols}`}>
        {items.map((item, i) => {
          const initial = (item.name.trim() || "К").slice(0, 1).toUpperCase();
          return (
            <figure
              key={i}
              className="flex flex-col gap-4 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-6 shadow-(--sf-shadow)"
            >
              <figcaption className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--sf-primary) font-bold text-(--sf-on-primary)"
                >
                  {initial}
                </span>
                <span className="flex min-w-0 flex-col">
                  {item.name && (
                    <span className="truncate font-medium text-(--sf-text)">{item.name}</span>
                  )}
                  <Stars />
                </span>
              </figcaption>
              <blockquote className="leading-relaxed text-(--sf-muted)">{item.text}</blockquote>
            </figure>
          );
        })}
      </div>
    </SectionShell>
  );
}
