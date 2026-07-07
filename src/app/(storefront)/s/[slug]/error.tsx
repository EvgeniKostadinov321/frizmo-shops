"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Брандиран error boundary за storefront-а. Рендерира се извън темата на
 * магазина (грешката може да е в самия layout / зареждането на настройките),
 * затова ползва платформените токени — като not-found.tsx.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    /* Структуриран лог за Vercel — без детайли към клиента. */
    console.error("storefront error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <Image
        src="/bee-lost.png"
        alt=""
        aria-hidden
        width={160}
        height={160}
        className="h-36 w-auto object-contain sm:h-40"
      />
      <h1 className="text-2xl font-bold text-ink-900">Нещо се обърка</h1>
      <p className="max-w-md text-ink-700">
        Страницата не можа да се зареди. Опитай отново след малко.
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-control bg-ink-900 px-5 font-medium text-white transition-opacity hover:opacity-90"
        >
          Опитай пак
        </button>
        <Link href="/" className="text-brand-600 underline hover:text-brand-700">
          Към Frizmo Shops
        </Link>
      </div>
    </main>
  );
}
