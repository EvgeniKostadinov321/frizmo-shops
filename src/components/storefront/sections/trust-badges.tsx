import type { SectionOfType } from "@/schemas/site-settings";

const ICONS: Record<string, string> = {
  truck: "🚚",
  shield: "🛡️",
  return: "↩️",
  phone: "📞",
  leaf: "🌿",
  star: "⭐",
};

export function TrustBadgesSection({ data }: { data: SectionOfType<"trust-badges">["data"] }) {
  const items = data.items.filter((i) => i.text.trim());
  if (items.length === 0) return null;

  return (
    <section className="w-full border-y border-(--sf-border) bg-(--sf-surface)">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-4 px-4 py-6">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-medium text-(--sf-text)">
            <span aria-hidden className="text-xl">
              {ICONS[item.icon]}
            </span>
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
