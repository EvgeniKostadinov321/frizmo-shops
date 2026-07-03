import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPostDate, getAllPosts, getPost } from "@/lib/blog";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Frizmo Shops`,
    description: post.description,
    openGraph: { title: post.title, description: post.description, type: "article" },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  /* Свързани статии — до 2 други, най-нови първо. */
  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            author: { "@type": "Organization", name: "Frizmo Shops" },
          }),
        }}
      />

      {/* Заглавна зона */}
      <header className="border-b border-surface-200 bg-surface-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            ← Всички статии
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span className="inline-flex items-center rounded-full border border-surface-200 px-2.5 py-0.5 font-semibold text-brand-700">
              {post.category}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} мин четене</span>
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance text-ink-900 sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">{post.description}</p>
        </div>
      </header>

      {/* Тяло: съдържание + странична навигация */}
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 lg:grid-cols-[1fr_15rem]">
        <article
          className="min-w-0 max-w-3xl text-[17px] text-ink-700 [&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline [&_a:hover]:text-brand-700 [&_em]:italic [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-ink-900 [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-900 [&_li]:mb-2 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-5 [&_p]:leading-[1.75] [&_strong]:font-bold [&_strong]:text-ink-900 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* В тази статия — навигация по заглавия (desktop) */}
        {post.headings.length > 1 && (
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">
                В тази статия
              </p>
              <ul className="mt-4 flex flex-col gap-2.5 border-l border-surface-200 pl-4 text-sm">
                {post.headings.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className="block text-ink-500 transition-colors hover:text-brand-600"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>

      {/* CTA лента */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-8">
        <div className="overflow-hidden rounded-card bg-brand-surface p-8 text-center sm:p-10">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-brand-surface-ink sm:text-3xl">
            Готов да продаваш онлайн?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-brand-surface-muted">
            Създай магазина си за минути — 30 дни безплатно с пълен Pro достъп, без карта.
          </p>
          <Link
            href="/auth/register"
            className="mt-6 inline-flex h-11 items-center rounded-control bg-brand-surface-ink px-6 font-bold text-brand-surface transition-transform hover:-translate-y-0.5"
          >
            Създай магазина си
          </Link>
        </div>
      </div>

      {/* Свързани статии */}
      {related.length > 0 && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <p className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
            <span className="shrink-0">Още статии</span>
            <span aria-hidden className="h-px flex-1 bg-surface-200" />
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col rounded-card border border-surface-200 bg-surface-0 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card"
              >
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="font-semibold text-brand-700">{p.category}</span>
                  <span aria-hidden>·</span>
                  <span>{p.readingMinutes} мин</span>
                </div>
                <span className="mt-2 font-bold leading-snug text-ink-900 group-hover:text-brand-700">
                  {p.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
