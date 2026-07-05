import { Icon, type IconName } from "@/components/ui";
import type { SectionOfType } from "@/schemas/site-settings";

/** Trust badge икона → вътрешен Icon (без емоджи — консистентно на всяка тема/OS). */
const ICONS: Record<string, IconName> = {
  truck: "truck",
  shield: "shield-check",
  return: "return",
  phone: "phone",
  leaf: "leaf",
  star: "star",
};

export function TrustBadgesSection({ data }: { data: SectionOfType<"trust-badges">["data"] }) {
  const items = data.items.filter((i) => i.text.trim());
  if (items.length === 0) return null;

  /* Плочки с икона в кръгче — присъствени, не плоска линия. Центрирани и
     увиващи се: изглеждат завършено при 2, 4 или 6 badge-а. */
  return (
    <section className="w-full border-y border-(--sf-border) bg-(--sf-surface)">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-4 py-8">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex w-[calc(50%-0.375rem)] items-center gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 shadow-(--sf-shadow) sm:w-auto sm:min-w-52 sm:flex-1 sm:basis-40 lg:max-w-72"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--sf-primary)/12 text-(--sf-primary)">
              <Icon name={ICONS[item.icon] ?? "check"} size={20} />
            </span>
            <span className="text-sm font-medium leading-snug text-(--sf-text)">{item.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
