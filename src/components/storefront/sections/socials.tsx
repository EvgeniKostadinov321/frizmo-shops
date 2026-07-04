import { Icon, type IconName } from "@/components/ui";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";
import type { SectionContext } from "./index";

interface SocialsProps {
  data: SectionOfType<"socials">["data"];
  ctx: SectionContext;
}

export function SocialsSection({ data, ctx }: SocialsProps) {
  const links = (ctx.shop.socialLinks as { facebook?: string; instagram?: string } | null) ?? {};
  const items = [
    { href: links.facebook, label: "Facebook", icon: "facebook" as IconName },
    { href: links.instagram, label: "Instagram", icon: "instagram" as IconName },
  ].filter((i): i is { href: string; label: string; icon: IconName } => Boolean(i.href));
  if (items.length === 0) return null;

  return (
    <SectionShell title={data.title || "Последвай ни"} className="text-center">
      <div className="flex justify-center gap-4">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-5 font-medium text-(--sf-text) transition-colors hover:border-(--sf-primary)"
          >
            <Icon name={item.icon} size={18} className="text-(--sf-primary)" />
            {item.label}
          </a>
        ))}
      </div>
    </SectionShell>
  );
}
