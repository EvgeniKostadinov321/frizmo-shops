import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";

export function PromoBannerSection({ data }: { data: SectionOfType<"promo-banner">["data"] }) {
  if (!data.title && !data.text) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="relative overflow-hidden rounded-(--sf-radius) bg-(--sf-primary)">
        {data.imagePath && (
          <>
            <Image
              src={publicImageUrl(data.imagePath)}
              alt=""
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative flex flex-col items-start gap-3 p-8 text-white sm:p-12">
          {data.title && (
            <h2
              className="text-2xl sm:text-3xl"
              style={{ fontWeight: "var(--sf-heading-weight)" as never }}
            >
              {data.title}
            </h2>
          )}
          {data.text && <p className="max-w-xl text-white/90">{data.text}</p>}
          {data.ctaLabel && data.ctaHref && (
            <Link
              href={data.ctaHref}
              className="mt-2 inline-flex h-11 items-center rounded-(--sf-radius) bg-white px-5 font-medium text-(--sf-primary) transition-opacity hover:opacity-90"
            >
              {data.ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
