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

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
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

      <Link href="/blog" className="text-sm text-brand-600 hover:underline">
        ← Всички статии
      </Link>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">
        {post.title}
      </h1>
      <time dateTime={post.date} className="mt-2 block text-sm text-ink-500">
        {formatPostDate(post.date)}
      </time>

      {/* Типография за статията — доверено съдържание от repo-то */}
      <div
        className="mt-8 flex flex-col text-ink-700 [&_a]:text-brand-600 [&_a]:underline [&_a:hover]:text-brand-700 [&_em]:italic [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-900 [&_li]:mb-1.5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_p]:leading-relaxed [&_strong]:font-bold [&_strong]:text-ink-900 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      <div className="mt-10 rounded-card border border-brand-500 bg-brand-50 p-6 text-center">
        <p className="font-bold text-ink-900">Готов да продаваш онлайн?</p>
        <p className="mt-1 text-sm text-ink-700">
          Създай магазина си за минути — 14 дни безплатно, без карта.
        </p>
        <Link
          href="/auth/register"
          className="mt-4 inline-flex h-11 items-center rounded-control bg-brand-600 px-5 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Започни сега
        </Link>
      </div>
    </article>
  );
}
