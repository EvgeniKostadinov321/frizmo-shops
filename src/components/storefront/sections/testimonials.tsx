import type { SectionOfType } from "@/schemas/site-settings";

/** ★★★★★ в акцентния цвят — отзивите на търговеца са по природа 5/5. */
function Stars() {
  return (
    <span aria-hidden className="tracking-[0.2em] text-(--sf-accent)">
      ★★★★★
    </span>
  );
}

/**
 * Драматична инверсия: секцията е върху цвета на текста (тъмна при светли
 * теми, светла при тъмни) — брандов момент в средата на страницата.
 */
export function TestimonialsSection({
  data,
}: {
  data: SectionOfType<"testimonials">["data"];
}) {
  const items = data.items.filter((i) => i.text.trim());
  if (items.length === 0) return null;

  const single = items.length === 1;
  const cols =
    items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="bg-(--sf-text) text-(--sf-bg)">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <div className={`mb-12 ${single ? "text-center" : ""}`}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-accent)">
            Отзиви
          </p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1]">
            {data.title || "Какво казват клиентите"}
          </h2>
        </div>

        {single ? (
          <figure className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <span aria-hidden className="font-(family-name:--sf-font-heading) text-7xl leading-none text-(--sf-accent)">
              „
            </span>
            <blockquote className="-mt-8 text-[clamp(1.25rem,2.5vw,1.75rem)] leading-snug">
              {items[0]!.text}
            </blockquote>
            <figcaption className="flex items-center gap-3 text-sm opacity-80">
              <Stars />
              {items[0]!.name && <span className="font-medium">{items[0]!.name}</span>}
            </figcaption>
          </figure>
        ) : (
          <div className={`grid gap-10 md:gap-0 ${cols}`}>
            {items.map((item, i) => (
              <figure
                key={i}
                className={`flex flex-col gap-4 md:px-10 ${
                  i > 0 ? "md:border-l md:border-(--sf-bg)/15" : "md:pl-0"
                } ${i === items.length - 1 ? "md:pr-0" : ""}`}
              >
                <span aria-hidden className="font-(family-name:--sf-font-heading) text-5xl leading-none text-(--sf-accent)">
                  „
                </span>
                <blockquote className="-mt-3 text-lg leading-relaxed">{item.text}</blockquote>
                <figcaption className="mt-auto flex items-center gap-3 pt-2 text-sm opacity-80">
                  <Stars />
                  {item.name && <span className="font-medium">{item.name}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
