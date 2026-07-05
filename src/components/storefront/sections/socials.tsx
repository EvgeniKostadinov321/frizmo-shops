import { Icon, type IconName } from "@/components/ui";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell, type SectionTone } from "./shared";
import type { SectionContext } from "./index";

interface SocialsProps {
  data: SectionOfType<"socials">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}

export function SocialsSection({ data, ctx, tone }: SocialsProps) {
  const links = (ctx.shop.socialLinks as { facebook?: string; instagram?: string } | null) ?? {};
  const items = [
    { href: links.facebook, label: "Facebook", icon: "facebook" as IconName },
    { href: links.instagram, label: "Instagram", icon: "instagram" as IconName },
  ].filter((i): i is { href: string; label: string; icon: IconName } => Boolean(i.href));
  if (items.length === 0) return null;

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-(--sf-text)">
          {data.title || "Последвай ни"}
        </h2>
        <div className="flex justify-center gap-4">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              title={item.label}
              className="flex size-14 items-center justify-center rounded-full border border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-text) shadow-(--sf-shadow) transition-colors hover:border-(--sf-primary) hover:bg-(--sf-primary) hover:text-(--sf-on-primary)"
            >
              <Icon name={item.icon} size={22} />
            </a>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
