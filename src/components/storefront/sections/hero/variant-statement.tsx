import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import {
  AccentTitle,
  HeroCta,
  HeroKicker,
  HeroSecondary,
  type HeroVariantProps,
  stagger,
} from "./shared";

/** Едва доловим тон за формите във фона (смес от primary и фона на темата). */
const tint = (pct: number) => `color-mix(in oklab, var(--sf-surface), var(--sf-primary) ${pct}%)`;

/**
 * Statement — спокоен тонален блок (surface фон, НЕ крещящ цвят) с асиметрична
 * композиция: едра типография вляво, снимка-„картичка" вдясно — накривена, с
 * плътна офсетна сянка в брандовия цвят (единственият силен цветен момент).
 * Едва доловими тонални кръгове дават дълбочина; marquee лента отдолу е
 * подписът. Различен от split (рамкиран прозорец) и poster (снимка-фон).
 */
export function HeroStatement({ data, ctx }: HeroVariantProps) {
  const image = data.imagePaths[0];
  const title = data.title || ctx.shop.name;
  const marqueeParts = Array.from({ length: 4 }, () =>
    [ctx.shop.name, ctx.shop.businessCategory, ctx.shop.city].filter(Boolean),
  ).flat();

  return (
    <section className="sf-grain relative flex min-h-[calc(100dvh-var(--sf-chrome,4.75rem))] w-full flex-col overflow-hidden bg-(--sf-surface) text-(--sf-text)">
      {/* Тонални форми — дълбочина, едва доловими (не крещят) */}
      <div
        aria-hidden
        className="absolute -right-32 -top-40 size-168 rounded-full"
        style={{ background: tint(13) }}
      />
      <div
        aria-hidden
        className="absolute -bottom-52 -left-36 size-136 rounded-full"
        style={{ background: tint(8) }}
      />
      <div
        aria-hidden
        className="absolute right-[16%] top-[14%] hidden size-56 rounded-full border border-(--sf-border) lg:block"
      />

      {/* Съдържание — асиметрия: текст вляво, снимка-картичка вдясно */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-14 md:grid-cols-[3fr_2fr] md:gap-14 md:py-16">
        <div className="flex flex-col items-start gap-5">
          <div className="sf-rise" style={stagger(0)}>
            <HeroKicker category={ctx.shop.businessCategory} city={ctx.shop.city} />
          </div>
          <div className="sf-rise" style={stagger(1)}>
            <AccentTitle
              title={title}
              accent={data.accentLastWord}
              className="wrap-break-word text-balance text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] text-(--sf-text)"
            />
          </div>
          {data.subtitle && (
            <p
              className="sf-rise max-w-xl text-pretty text-lg leading-relaxed text-(--sf-muted) md:text-xl"
              style={stagger(2)}
            >
              {data.subtitle}
            </p>
          )}
          <div
            className="sf-rise mt-2 flex flex-wrap items-center gap-x-6 gap-y-3"
            style={stagger(3)}
          >
            <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} large />
            <HeroSecondary base={ctx.base} show={data.showStoryLink} />
          </div>
        </div>

        {/* Снимка-картичка: накривена, с плътна офсетна сянка в брандовия цвят */}
        {image && (
          <div className="sf-rise relative mx-auto w-64 sm:w-72 md:w-full md:max-w-sm" style={stagger(4)}>
            <div
              /* Фото-рамка (raised паспарту) + плътна primary офсетна сянка —
                 картичката „стои", не плува (одит 2026-07-05). */
              className="relative rotate-2 overflow-hidden rounded-(--sf-radius) border-8 border-(--sf-surface-raised) transition-transform duration-500 hover:rotate-0"
              style={{ boxShadow: "0.875rem 0.875rem 0 0 var(--sf-primary)" }}
            >
              <div className="sf-frame relative aspect-4/5">
                <Image
                  src={publicImageUrl(image)}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 18rem, 24rem"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Marquee лента — подписът на варианта (безкраен ход, motion-safe) */}
      <div className="relative z-10 w-full overflow-hidden border-t border-(--sf-border) py-4">
        <div className="sf-marquee flex w-max items-center gap-10 whitespace-nowrap">
          {[...marqueeParts, ...marqueeParts].map((part, i) => (
            <span
              key={i}
              aria-hidden={i >= marqueeParts.length}
              className="text-sm font-bold uppercase tracking-[0.3em] text-(--sf-muted) opacity-60"
            >
              {part}&nbsp;&nbsp;·
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
