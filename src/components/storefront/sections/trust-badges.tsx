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

  return (
    <section className="w-full border-y border-(--sf-border) bg-(--sf-surface)">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-4 px-4 py-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-medium text-(--sf-text)">
            <Icon name={ICONS[item.icon] ?? "check"} size={20} className="text-(--sf-primary)" />
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
