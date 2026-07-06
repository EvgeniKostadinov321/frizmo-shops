import { Icon } from "@/components/ui";
import type { SectionOfType } from "@/schemas/site-settings";
import { buildSocialItems, type SocialItem } from "@/lib/socials";
import { SectionShell, type SectionTone } from "./shared";
import type { SectionContext } from "./index";

interface SocialsProps {
  data: SectionOfType<"socials">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}

/**
 * Три композиции (малка секция → в един файл): 1 = центрирани пилюли с име,
 * 2 = плътна primary CTA лента (брандов момент в края на страницата),
 * 3 = editorial hairline редове със стрелки.
 */
export function SocialsSection({ data, ctx, tone }: SocialsProps) {
  const items: SocialItem[] = buildSocialItems(ctx.shop.socialLinks as never);
  if (items.length === 0) return null;

  /* Вариант 2 — плътна CTA лента върху primary */
  if (data.variant === 2) {
    return (
      <section className="bg-(--sf-primary) text-(--sf-on-primary)">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center sm:py-16 md:flex-row md:justify-between md:text-left">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight">
            {data.title || "Последвай ни"}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2.5 rounded-(--sf-radius) bg-(--sf-on-primary) px-6 font-medium text-(--sf-primary) transition-opacity hover:opacity-90"
              >
                <Icon name={item.icon} size={19} />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* Вариант 3 — editorial hairline редове */
  if (data.variant === 3) {
    return (
      <SectionShell tone={tone} titleHidden>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <span aria-hidden className="h-0.5 w-10 bg-(--sf-primary)" />
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-(--sf-text)">
              {data.title || "Последвай ни"}
            </h2>
          </div>
          <div className="border-t border-(--sf-border)">
            {items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-16 items-center gap-4 border-b border-(--sf-border) py-4"
              >
                <span aria-hidden className="text-(--sf-primary)">
                  <Icon name={item.icon} size={22} />
                </span>
                <span
                  className="font-(family-name:--sf-font-heading) text-xl text-(--sf-text) transition-transform duration-300 group-hover:translate-x-1"
                  style={{ fontWeight: "var(--sf-heading-weight)" }}
                >
                  {item.label}
                </span>
                <span
                  aria-hidden
                  className="ml-auto -translate-x-1.5 text-xl text-(--sf-primary) opacity-40 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                >
                  →
                </span>
              </a>
            ))}
          </div>
        </div>
      </SectionShell>
    );
  }

  /* Вариант 1 — центрирани пилюли с име (по-ясни от голи кръгчета) */
  return (
    <SectionShell tone={tone} titleHidden>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
            Социални
          </p>
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-(--sf-text)">
            {data.title || "Последвай ни"}
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2.5 rounded-full border border-(--sf-border) bg-(--sf-surface-raised) px-6 font-medium text-(--sf-text) shadow-(--sf-shadow) transition-colors hover:border-(--sf-primary) hover:bg-(--sf-primary) hover:text-(--sf-on-primary)"
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
