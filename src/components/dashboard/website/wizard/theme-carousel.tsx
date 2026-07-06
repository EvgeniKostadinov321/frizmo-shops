"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { THEME_PALETTES } from "@/lib/site-recipes";
import type { ThemeId } from "@/schemas/site-settings";
import { ThemePreviewCard } from "./theme-preview-card";

interface ThemeCarouselProps {
  themes: ThemeId[];
  activeTheme: ThemeId;
  shopName: string;
  onSelect: (theme: ThemeId) => void;
}

/**
 * Каруселът на тема-стъпката: scroll-snap лента (по механиката на editorial
 * продуктовия слайдър). Десктоп = 3 големи карти на „страница" + peek на
 * следващата + стрелки + drag; телефон = една карта per swipe + peek.
 * Точките-индикатор пазят от скрито съдържание (видима алтернатива на жеста).
 */
export function ThemeCarousel({ themes, activeTheme, shopName, onSelect }: ThemeCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /** Стъпка на „страница": колко карти се виждат × (ширина + реалния gap). */
  function pageStep(el: HTMLDivElement): number {
    const cards = el.querySelectorAll<HTMLElement>("[data-carousel-card]");
    if (cards.length < 2) return el.clientWidth;
    const cardSpan = cards[1]!.offsetLeft - cards[0]!.offsetLeft;
    const visible = Math.max(1, Math.round(el.clientWidth / cardSpan));
    return cardSpan * visible;
  }

  function measure() {
    const el = scrollerRef.current;
    if (!el) return;
    const step = pageStep(el);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setPages(Math.max(1, Math.round(maxScroll / step) + 1));
    setPage(Math.min(Math.round(el.scrollLeft / step), Math.round(maxScroll / step)));
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft > maxScroll - 8);
  }

  function onScroll() {
    requestAnimationFrame(measure);
  }

  /* Начално позициониране върху избраната тема (state-preservation при
     връщане от следваща стъпка). */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>(`[data-theme="${activeTheme}"]`);
    if (active && active.offsetLeft > el.clientWidth * 0.6) {
      el.scrollTo({ left: active.offsetLeft - 16, behavior: "instant" });
    }
    queueMicrotask(measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollByPage(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * pageStep(el), behavior: "smooth" });
  }

  function scrollToPage(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * pageStep(el), behavior: "smooth" });
  }

  /* Desktop drag-to-scroll: мишката влачи лентата (touch си има нативен
     swipe). Праг 6px пази нормалния клик върху карта; по време на влачене
     snap-ът е изключен, на пускане лентата се доснапва към най-близката
     карта. Кликът след влачене се потиска (capture), за да не избере тема. */
  const drag = useRef({ down: false, dragged: false, startX: 0, startScroll: 0 });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { down: true, dragged: false, startX: e.clientX, startScroll: el.scrollLeft };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.dragged && Math.abs(dx) < 6) return;
    if (!drag.current.dragged) {
      drag.current.dragged = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      el.style.cursor = "grabbing";
    }
    el.scrollLeft = drag.current.startScroll - dx;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    const wasDragged = drag.current.dragged;
    drag.current.down = false;
    if (!el || !wasDragged) return;
    el.releasePointerCapture(e.pointerId);
    el.style.cursor = "";
    el.style.scrollBehavior = "";
    /* Доснапване към най-близката карта, после връщаме snap-а. */
    const cards = el.querySelectorAll<HTMLElement>("[data-carousel-card]");
    const span = cards.length > 1 ? cards[1]!.offsetLeft - cards[0]!.offsetLeft : el.clientWidth;
    const target = Math.round(el.scrollLeft / span) * span;
    el.scrollTo({ left: target, behavior: "smooth" });
    setTimeout(() => {
      el.style.scrollSnapType = "";
    }, 350);
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (drag.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.dragged = false;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <div className="relative">
        {/* Стрелки — само при курсор (touch ползва swipe) */}
        <button
          type="button"
          aria-label="Предишни теми"
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          className="absolute -left-4 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-surface-200 bg-surface-0 text-ink-700 shadow-card transition-all hover:-translate-x-0.5 hover:-translate-y-1/2 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-0 lg:flex"
        >
          <Icon name="chevron-down" size={20} className="rotate-90" />
        </button>
        <button
          type="button"
          aria-label="Следващи теми"
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          className="absolute -right-4 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-surface-200 bg-surface-0 text-ink-700 shadow-card transition-all hover:-translate-y-1/2 hover:translate-x-0.5 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-0 lg:flex"
        >
          <Icon name="chevron-down" size={20} className="-rotate-90" />
        </button>

        {/* Лентата: телефон = 1 карта, десктоп = точно 3 на страница.
            Fade-маската по ръбовете прави peek-а на съседния слайд елегантен
            (кубче, което избледнява) вместо грубо отрязана карта. */}
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          className="flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 py-2 scroll-pl-5 scrollbar-none mask-[linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)] select-none [&::-webkit-scrollbar]:hidden lg:gap-5 lg:px-8 lg:scroll-pl-8 lg:mask-[linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]"
        >
          {themes.map((t) => (
            <div
              key={t}
              data-carousel-card
              data-theme={t}
              className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.375rem)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              <ThemePreviewCard
                theme={t}
                palette={THEME_PALETTES[t][0]!}
                shopName={shopName}
                active={activeTheme === t}
                onSelect={() => onSelect(t)}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>

      </div>

      {/* Точки-индикатор: колко „страници" има и къде си */}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center" role="tablist" aria-label="Страници с теми">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={`Страница ${i + 1} от ${pages}`}
              onClick={() => scrollToPage(i)}
              /* Hit-областта е 32×32 (9 точки × 44 не се събират на 375px;
                 32 е достатъчна тъч цел без gap между тях). */
              className="group/dot flex size-8 items-center justify-center"
            >
              <span
                className={`h-2.5 rounded-full transition-all ${
                  i === page
                    ? "w-7 bg-ink-900"
                    : "w-2.5 bg-surface-300 group-hover/dot:bg-surface-400"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
