import type { Metadata } from "next";
import Link from "next/link";
import { formatPostDate, getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Блог — Frizmo Shops",
  description:
    "Практични съвети за онлайн търговия в България: продажби, доставки, ЗЗП и растеж на малкия бизнес.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
        Блог
      </h1>
      <p className="mt-1 text-ink-500">
        Практични съвети за онлайн търговия — без жаргон, направо по същество.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="flex flex-col gap-2 rounded-card border border-surface-200 bg-surface-0 p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
          >
            <time dateTime={post.date} className="text-xs text-ink-500">
              {formatPostDate(post.date)}
            </time>
            <h2 className="text-xl font-bold text-ink-900">{post.title}</h2>
            <p className="text-sm text-ink-700">{post.description}</p>
            <span className="text-sm font-medium text-brand-600">Прочети →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
