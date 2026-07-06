import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import { HeroVideo } from "./hero-video";
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
 * Poster — editorial корица: пълноекранна снимка + текст ЗАКОТВЕН долу-ляво в
 * компактен блок (не центриран, не разлят — това го отличава от старото „full").
 * Диагонален scrim само в долната лява четвърт пази четимостта, без да покрива
 * цялата снимка. Header-ът лежи върху секцията (100dvh − topbar). Темовият
 * подпис влиза през inset рамка (--sf-hero-frame). Без снимка → тонален
 * градиент + водна буква.
 */
export function HeroPoster({ data, ctx }: HeroVariantProps) {
  const image = data.imagePaths[0];
  const video = data.videoPath;
  /* Има фон = снимка ИЛИ видео → scrim + бял текст. */
  const hasBackground = Boolean(image || video);
  const title = data.title || ctx.shop.name;
  const initial = ctx.shop.name.slice(0, 1).toUpperCase();

  return (
    <section className="relative flex min-h-[calc(100dvh-var(--sf-chrome,0rem))] w-full overflow-hidden">
      {hasBackground ? (
        <>
          {video ? (
            <HeroVideo videoPath={video} posterPath={image} />
          ) : (
            <Image
              src={publicImageUrl(image!)}
              alt=""
              fill
              sizes="100vw"
              className="sf-kenburns object-cover"
              priority
            />
          )}
          {/* Двоен scrim: диагонален (плътен долу-ляво под текста) + долен
              вертикален — гарантира четимост дори върху СВЕТЛА снимка, докато
              горе-дясно снимката диша. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, rgba(0,0,0,.9) 0%, rgba(0,0,0,.62) 24%, rgba(0,0,0,.2) 48%, transparent 68%), linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.2) 30%, transparent 55%)",
            }}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-(--sf-surface) via-(--sf-bg) to-(--sf-bg)"
          />
          <Watermark letter={initial} />
        </>
      )}

      {/* Inset рамка — темов подпис (Оникс: златен кант, иначе прозрачна). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-4 hidden md:block md:[box-shadow:var(--sf-hero-frame)]"
      />

      {/* Съдържание — закотвено долу-ляво. ВАЖНО: подравняващият padding е на
          пълноширинната обвивка, а текстът е в ЧИСТ max-w блок вътре — иначе
          огромният px (на широк екран ~400px/страна) изяжда max-w кутията и
          всяка дума колабира на свой ред. */}
      <div className="relative z-10 mt-auto w-full px-4 pb-14 pt-24 md:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] md:pb-16">
        <div
          className={`flex max-w-2xl flex-col items-start gap-5 ${
            hasBackground ? "text-white" : "text-(--sf-text)"
          }`}
        >
          <div className="sf-rise" style={stagger(0)}>
            <HeroKicker
              category={ctx.shop.businessCategory}
              city={ctx.shop.city}
              light={hasBackground}
            />
          </div>
          <div className="sf-rise" style={stagger(1)}>
            <AccentTitle
              title={title}
              dark={hasBackground}
              accent={data.accentLastWord}
              className={`text-balance text-[clamp(2.75rem,8vw,6rem)] leading-[0.98] ${hasBackground ? "drop-shadow-md" : ""}`}
            />
          </div>
          {data.subtitle && (
            <p
              className={`sf-rise max-w-xl text-pretty text-lg leading-relaxed md:text-xl ${
                hasBackground ? "text-white/90" : "text-(--sf-muted)"
              }`}
              style={stagger(2)}
            >
              {data.subtitle}
            </p>
          )}
          <div className="sf-rise mt-1 flex flex-wrap items-center gap-x-6 gap-y-2" style={stagger(3)}>
            <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} large />
            <HeroSecondary base={ctx.base} light={hasBackground} show={data.showStoryLink} />
          </div>
        </div>
      </div>

      <ScrollCue
        className={`bottom-6 right-6 hidden md:block ${hasBackground ? "text-white" : "text-(--sf-text)"}`}
      />
    </section>
  );
}
