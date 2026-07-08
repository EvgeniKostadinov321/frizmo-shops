"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Споделен брандиран error UI за route-group error boundary-тата. Ползва
 * платформените токени (грешката може да е в layout-а), логва структурирано за
 * Vercel и предлага „Опитай пак" (reset) + връзка към началото.
 */
export function ErrorState({
  error,
  reset,
  scope,
  homeHref = "/",
  homeLabel = "Към началото",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** За лога — коя част гръмна (dashboard/catalog/…). */
  scope: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(`${scope} error:`, error);
  }, [error, scope]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-4 text-center">
      <Image
        src="/bee-lost.png"
        alt=""
        aria-hidden
        width={160}
        height={160}
        className="h-32 w-auto object-contain sm:h-36"
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
        <Link href={homeHref} className="text-brand-600 underline hover:text-brand-700">
          {homeLabel}
        </Link>
      </div>
    </main>
  );
}
