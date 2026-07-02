import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "./index";

interface HeroProps {
  data: SectionOfType<"hero">["data"];
  ctx: SectionContext;
}

function HeroCta({ label, href, base }: { label: string; href: string; base: string }) {
  if (!label) return null;
  return (
    <Link
      href={href || `${base}/products`}
      className="inline-flex h-12 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 text-base font-medium text-white transition-opacity hover:opacity-90"
    >
      {label}
    </Link>
  );
}

export function HeroSection({ data, ctx }: HeroProps) {
  const image = data.imagePaths[0];

  if (data.layout === "split") {
    return (
      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2">
        <div className="flex flex-col items-start gap-4">
          <h1
            className="text-4xl text-(--sf-text)"
            style={{ fontWeight: "var(--sf-heading-weight)" as never }}
          >
            {data.title || ctx.shop.name}
          </h1>
          {data.subtitle && <p className="text-lg text-(--sf-muted)">{data.subtitle}</p>}
          <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} />
        </div>
        {image && (
          <div className="relative aspect-4/3 overflow-hidden rounded-(--sf-radius)">
            <Image
              src={publicImageUrl(image)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
        )}
      </section>
    );
  }

  if (data.layout === "slideshow" && data.imagePaths.length > 0) {
    return (
      <section className="w-full">
        <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
          <h1
            className="text-4xl text-(--sf-text)"
            style={{ fontWeight: "var(--sf-heading-weight)" as never }}
          >
            {data.title || ctx.shop.name}
          </h1>
          {data.subtitle && <p className="mt-3 text-lg text-(--sf-muted)">{data.subtitle}</p>}
          <div className="mt-4">
            <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} />
          </div>
        </div>
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4">
          {data.imagePaths.map((path) => (
            <div
              key={path}
              className="relative aspect-video w-5/6 max-w-2xl shrink-0 snap-center overflow-hidden rounded-(--sf-radius)"
            >
              <Image
                src={publicImageUrl(path)}
                alt=""
                fill
                sizes="80vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  /* full — снимка с текст върху нея (или плътен фон без снимка) */
  return (
    <section className="relative w-full">
      {image && (
        <>
          <Image
            src={publicImageUrl(image)}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div aria-hidden className="absolute inset-0 bg-black/45" />
        </>
      )}
      <div
        className={`relative mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-20 text-center sm:py-28 ${
          image ? "text-white" : "text-(--sf-text)"
        }`}
      >
        <h1
          className="max-w-3xl text-4xl sm:text-5xl"
          style={{ fontWeight: "var(--sf-heading-weight)" as never }}
        >
          {data.title || ctx.shop.name}
        </h1>
        {data.subtitle && (
          <p className={`max-w-2xl text-lg ${image ? "text-white/90" : "text-(--sf-muted)"}`}>
            {data.subtitle}
          </p>
        )}
        <HeroCta label={data.ctaLabel} href={data.ctaHref} base={ctx.base} />
      </div>
    </section>
  );
}
