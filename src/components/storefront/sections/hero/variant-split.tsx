import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import {
  AccentTitle,
  HeroCta,
  HeroKicker,
  HeroSecondary,
  type HeroVariantProps,
  ScrollCue,
  stagger,
  Watermark,
} from "./shared";

/**
 * Split — текст вляво (асиметрия 7/5, водна буква + зърно), снимката е вписан
 * „арков прозорец" вдясно с темовата рамка (--sf-hero-radius арка /
 * --sf-hero-frame офсетен блок·кант), подравнен с контейнера. Височина = точно
 * екранът минус chrome-а над hero-то (--sf-chrome). Еталонният вариант (Пулс).
 */
export function HeroSplit({ data, ctx }: HeroVariantProps) {
  const image = data.imagePaths[0];
  const title = data.title || ctx.shop.name;
  const initial = ctx.shop.name.slice(0, 1).toUpperCase();

  return (
    <section className="relative grid w-full md:min-h-[calc(100dvh-var(--sf-chrome,4.75rem))] md:grid-cols-12">
      <div className="sf-grain relative z-10 flex items-center overflow-hidden px-4 py-16 md:col-span-7 md:py-24 md:pl-[max(1rem,calc((100vw-72rem)/2+1rem))] md:pr-12">
        {/* Primary „мъгла" зад текста (ефект B) — само при топлите/меките теми */}
        <div
          aria-hidden
          className="absolute inset-0 [background:var(--sf-hero-mist)]"
        />
        <Watermark letter={initial} />
        <div className="relative flex max-w-2xl flex-col items-start gap-6">
          <div className="sf-rise" style={stagger(0)}>
            <HeroKicker category={ctx.shop.businessCategory} city={ctx.shop.city} />
          </div>
          <div className="sf-rise" style={stagger(1)}>
            <AccentTitle
              title={title}
              accent={data.accentLastWord}
              className="text-[clamp(2.75rem,6vw,4.75rem)] leading-[1.03] text-(--sf-text)"
            />
          </div>
          {data.subtitle && (
            <p
              className="sf-rise max-w-xl text-xl leading-relaxed text-(--sf-muted)"
              style={stagger(2)}
            >
              {data.subtitle}
            </p>
          )}
          <div className="sf-rise flex flex-wrap items-center gap-5" style={stagger(3)}>
            <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} large />
            <HeroSecondary base={ctx.base} show={data.showStoryLink} />
          </div>
        </div>
      </div>
      {image ? (
        <div className="relative flex md:col-span-5 md:items-stretch md:py-10 md:pr-[max(1rem,calc((100vw-72rem)/2+1rem))]">
          <div className="sf-frame relative min-h-[52svh] w-full overflow-hidden md:min-h-0 md:rounded-(--sf-hero-radius) md:[box-shadow:var(--sf-hero-frame)]">
            <Image
              src={publicImageUrl(image)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="sf-kenburns object-cover"
              priority
            />
          </div>
        </div>
      ) : (
        <div aria-hidden className="hidden md:col-span-5 md:block" />
      )}
      <ScrollCue className="bottom-8 left-[max(1.5rem,calc((100vw-72rem)/2+1rem))] hidden text-(--sf-text) md:block" />
    </section>
  );
}
