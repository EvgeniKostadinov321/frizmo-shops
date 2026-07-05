import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "./index";

export function PromoBannerSection({
  data,
  ctx,
}: {
  data: SectionOfType<"promo-banner">["data"];
  ctx: SectionContext;
}) {
  if (!data.title && !data.text) return null;
  const hasImage = Boolean(data.imagePath);

  /* „Купон-билет": целият текст с кода живее ВЪТРЕ в dashed рамка (талон за
     отрязване) — показва се винаги при наличен текст, не зависи от CTA полетата.
     Празен href → към продуктите. */
  const ticketInner = (
    <>
      {data.text && <span className="text-lg font-medium">{data.text}</span>}
      {data.ctaLabel && (
        <span className="inline-flex items-center gap-1.5 font-(family-name:--sf-font-heading) text-lg tracking-[0.14em]">
          {data.ctaLabel}
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      )}
    </>
  );
  const ticketClass = `group inline-flex max-w-full flex-wrap items-center gap-x-6 gap-y-2 border-2 border-dashed px-6 py-4 transition-colors ${
    hasImage
      ? "border-white/60 hover:border-white"
      : "border-(--sf-on-primary)/60 hover:border-(--sf-on-primary)"
  }`;

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
          {/* Диагонален scrim (плътен вляво, под текста) — четимост върху
              всякаква снимка; дясната част диша. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.6) 34%, rgba(0,0,0,.22) 62%, rgba(0,0,0,.05) 85%)",
            }}
          />
        </>
      )}
      <div
        className={`relative mx-auto flex min-h-72 w-full max-w-6xl flex-col justify-center gap-5 px-4 py-14 ${
          hasImage ? "text-white" : "text-(--sf-on-primary)"
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] opacity-75">Оферта</p>
        {data.title && (
          <h2 className="max-w-3xl text-balance text-[clamp(2.25rem,6vw,4.25rem)] leading-[1.02]">
            {data.title}
          </h2>
        )}
        {(data.text || data.ctaLabel) && (
          <div className="mt-2">
            {data.ctaLabel ? (
              <Link href={data.ctaHref || `${ctx.base}/products`} className={ticketClass}>
                {ticketInner}
              </Link>
            ) : (
              <div className={ticketClass}>{ticketInner}</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
