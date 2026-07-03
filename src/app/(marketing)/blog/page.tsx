import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { Icon } from "@/components/ui";
import { formatPostDate, getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Блог — Frizmo Shops",
  description:
    "Практични съвети за онлайн търговия в България: продажби, доставки, ЗЗП и растеж на малкия бизнес.",
};

export default function BlogPage() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      {/* Hero зона */}
      <div className="max-w-2xl">
        <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          <span className="shrink-0">Блог</span>
          <span aria-hidden className="h-px flex-1 bg-surface-200" />
        </p>
        <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-6xl">
          Съвети за онлайн търговия
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-700">
          Практично, без жаргон и направо по същество — как да продаваш повече, да доставяш
          спокойно и да растеш като малък български бизнес.
        </p>
      </div>

      {/* Акцентна (най-нова) статия */}
      {featured && (
        <Reveal className="mt-12">
          <Link
            href={`/blog/${featured.slug}`}
            className="group block overflow-hidden rounded-card border border-surface-200 bg-surface-0 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-float"
          >
            <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
              {/* Визуален панел — брандова повърхност вместо празна снимка */}
              <div className="relative flex min-h-52 flex-col justify-between overflow-hidden bg-brand-surface p-8 lg:min-h-full">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-surface-ink/12 px-3 py-1 text-xs font-bold text-brand-surface-ink">
                  {featured.category}
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -bottom-8 text-brand-surface-ink/10"
                >
                  <Icon name="store" size={160} />
                </span>
                <p className="relative text-sm font-medium text-brand-surface-muted">
                  Най-нова статия
                </p>
              </div>
              <div className="flex flex-col justify-center p-8">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <time dateTime={featured.date}>{formatPostDate(featured.date)}</time>
                  <span aria-hidden>·</span>
                  <span>{featured.readingMinutes} мин четене</span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 leading-relaxed text-ink-700">{featured.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-600 transition-transform group-hover:translate-x-0.5">
                  Прочети статията →
                </span>
              </div>
            </div>
          </Link>
        </Reveal>
      )}

      {/* Останалите статии */}
      {rest.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post, i) => (
            <Reveal key={post.slug} delay={i * 0.05}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col rounded-card border border-surface-200 bg-surface-0 p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card"
              >
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="inline-flex items-center rounded-full border border-surface-200 px-2.5 py-0.5 font-semibold text-brand-700">
                    {post.category}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{post.readingMinutes} мин</span>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold leading-snug tracking-tight text-ink-900">
                  {post.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">
                  {post.description}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-surface-100 pt-4 text-xs">
                  <time dateTime={post.date} className="text-ink-500">
                    {formatPostDate(post.date)}
                  </time>
                  <span className="font-bold text-brand-600 transition-transform group-hover:translate-x-0.5">
                    Прочети →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
