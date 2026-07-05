"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

interface GalleryGridProps {
  /** Публични URL-и на снимките (генерирани на сървъра). */
  urls: string[];
  /** duo = 1–2 снимки централен дует; masonry = 3+ разновисоки колони. */
  variant: "duo" | "masonry";
}

/** Пропорция per позиция за masonry ритъма. */
function aspectClass(i: number): string {
  return i % 3 === 0 ? "aspect-3/4" : i % 3 === 1 ? "aspect-square" : "aspect-4/3";
}

/**
 * Галериен grid + lightbox върху нативния <dialog> — без библиотека.
 * Escape затваря (нативно), стрелки ← → навигират, кликът върху фона затваря
 * (стандарт за lightbox — няма форма/данни за губене).
 */
export function GalleryGrid({ urls, variant }: GalleryGridProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);

  function open(i: number) {
    setIndex(i);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  const step = useCallback(
    (dir: -1 | 1) => {
      setIndex((cur) => (cur === null ? cur : (cur + dir + urls.length) % urls.length));
    },
    [urls.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  return (
    <>
      {variant === "duo" ? (
        <div className={`mx-auto grid max-w-4xl gap-4 ${urls.length === 2 ? "sm:grid-cols-2" : ""}`}>
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Увеличи снимка ${i + 1}`}
              onClick={() => open(i)}
              className="relative aspect-4/3 cursor-zoom-in overflow-hidden rounded-(--sf-radius) shadow-(--sf-shadow)"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.04]"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="columns-2 gap-4 md:columns-3 *:mb-4">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Увеличи снимка ${i + 1}`}
              onClick={() => open(i)}
              className={`relative block w-full cursor-zoom-in overflow-hidden rounded-(--sf-radius) shadow-(--sf-shadow) ${aspectClass(i)}`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.04]"
              />
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setIndex(null)}
        onClick={(e) => {
          /* клик върху самия dialog (фона) = затваряне; съдържанието спира протичането */
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-transparent backdrop:bg-black/85"
        aria-label="Преглед на снимка"
      >
        {index !== null && (
          <div className="pointer-events-none flex h-full w-full items-center justify-center p-4 sm:p-12">
            <div className="pointer-events-auto relative h-full w-full max-w-5xl">
              <Image src={urls[index]!} alt="" fill sizes="100vw" className="object-contain" />
            </div>
            <button
              type="button"
              aria-label="Затвори"
              onClick={close}
              className="pointer-events-auto absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <Icon name="x" size={22} />
            </button>
            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Предишна снимка"
                  onClick={() => step(-1)}
                  className="pointer-events-auto absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <Icon name="chevron-down" size={22} className="rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label="Следваща снимка"
                  onClick={() => step(1)}
                  className="pointer-events-auto absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <Icon name="chevron-down" size={22} className="-rotate-90" />
                </button>
                <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                  {index + 1} / {urls.length}
                </span>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
