"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { publicImageUrl } from "@/lib/storage";

/**
 * Видео фон за poster hero-то: muted loop, autoplay подсилен с JS `.play()`
 * (по-надежден от HTML атрибута — Opera/строги браузъри често отказват само на
 * HTML autoplay). При prefers-reduced-motion показва САМО постера.
 *
 * Fallback вериги, за да НЕ е никога черно:
 *  1. `poster` атрибут на видеото → показва се докато видеото зарежда/ако не тръгне.
 *  2. `<Image>` постер под видеото → покрива reduced-motion и мига преди зареждане.
 *  3. Тонален градиент най-отдолу → когато НЯМА качена снимка (постер).
 */
export function HeroVideo({ videoPath, posterPath }: { videoPath: string; posterPath?: string }) {
  const posterUrl = posterPath ? publicImageUrl(posterPath) : undefined;
  const mime = videoPath.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
  const videoRef = useRef<HTMLVideoElement>(null);

  /* Подсилен autoplay: някои браузъри (Opera, data-saver режими) отказват
     HTML `autoplay`, но приемат програмен .play() на muted видео. Тихо
     игнорираме отказ — тогава остава постерът (никога черно). */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      v.play().catch(() => {
        /* autoplay отказан → постерът остава видим */
      });
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
    return () => v.removeEventListener("loadeddata", tryPlay);
  }, [videoPath]);

  return (
    <>
      {/* Тонален градиент — базов фон, когато няма постер (без черно). */}
      {!posterUrl && (
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-(--sf-surface) via-(--sf-bg) to-(--sf-surface)"
        />
      )}
      {/* Постер снимка: винаги под видеото; при reduced-motion остава единствен. */}
      {posterUrl && (
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      )}
      {/* Видео: скрито само при reduced-motion (тогава постерът/градиентът остава). */}
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={posterUrl}
      >
        <source src={publicImageUrl(videoPath)} type={mime} />
      </video>
    </>
  );
}
