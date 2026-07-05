"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

/**
 * Лек карусел: CSS scroll-snap + стрелки (без библиотека). Свайп на тъч
 * работи нативно; стрелките са за desktop. Уважава reduced-motion
 * (smooth → auto скрол).
 */
export function Carousel({ children, label }: { children: React.ReactNode; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  function scrollByDir(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: smooth ? "smooth" : "auto" });
  }

  const arrowClass =
    "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-(--sf-border) bg-(--sf-surface-raised) text-(--sf-text) shadow-(--sf-shadow) transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative" role="region" aria-label={label}>
      <button
        type="button"
        aria-label="Предишни"
        disabled={!canPrev}
        onClick={() => scrollByDir(-1)}
        className={`${arrowClass} -left-3`}
      >
        <Icon name="chevron-down" size={20} className="rotate-90" />
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Следващи"
        disabled={!canNext}
        onClick={() => scrollByDir(1)}
        className={`${arrowClass} -right-3`}
      >
        <Icon name="chevron-down" size={20} className="-rotate-90" />
      </button>
    </div>
  );
}
