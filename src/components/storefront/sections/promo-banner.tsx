import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";

export function PromoBannerSection({ data }: { data: SectionOfType<"promo-banner">["data"] }) {
  if (!data.title && !data.text) return null;
  const hasImage = Boolean(data.imagePath);

  /* Брандов момент: плътен --sf-primary (или снимка + overlay), ОГРОМНО
     заглавие вляво, текст + CTA-„купон" (dashed рамка) вдясно. */
  return (
    <section className={`relative w-full overflow-hidden ${hasImage ? "" : "bg-(--sf-primary)"}`}>
      {hasImage && (
        <>
          <Image
            src={publicImageUrl(data.imagePath)}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0" style={{ background: "var(--sf-overlay)" }} />
        </>
      )}
      <div
        className={`relative mx-auto flex min-h-80 w-full max-w-6xl flex-col justify-center gap-8 px-4 py-14 md:flex-row md:items-center md:justify-between ${
          hasImage ? "text-white" : "text-(--sf-on-primary)"
        }`}
      >
        <div className="flex max-w-2xl flex-col gap-2">
          {data.title && (
            <h2 className="text-[clamp(2.25rem,6vw,4.25rem)] leading-[1.02]">{data.title}</h2>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-4 md:items-end">
          {data.text && (
            <p className={`max-w-sm text-lg md:text-right ${hasImage ? "text-white/90" : "opacity-90"}`}>
              {data.text}
            </p>
          )}
          {data.ctaLabel && data.ctaHref && (
            <Link
              href={data.ctaHref}
              className={`inline-flex h-13 items-center border-2 border-dashed px-8 font-(family-name:--sf-font-heading) text-lg tracking-[0.18em] transition-colors ${
                hasImage
                  ? "border-white/70 text-white hover:bg-white hover:text-black"
                  : "border-(--sf-on-primary)/70 text-(--sf-on-primary) hover:bg-(--sf-on-primary) hover:text-(--sf-primary)"
              }`}
            >
              {data.ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
