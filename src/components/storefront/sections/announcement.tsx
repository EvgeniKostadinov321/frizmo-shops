"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import { safeHref } from "@/lib/safe-url";
import type { SectionOfType } from "@/schemas/site-settings";

/** Ключ per текст → скриеш точно тази обява; нов текст я показва пак. */
function dismissKey(text: string): string {
  /* Кратък хеш на текста (djb2) — без да пазим целия низ в ключа. */
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return `frizmo-ann-${(h >>> 0).toString(36)}`;
}

export function AnnouncementSection({ data }: { data: SectionOfType<"announcement">["data"] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!data.text) return;
    /* queueMicrotask: синхронен setState в effect чупи react-compiler lint. */
    queueMicrotask(() => {
      try {
        if (window.localStorage.getItem(dismissKey(data.text))) setDismissed(true);
      } catch {
        /* private mode → просто не помним dismiss-а */
      }
    });
  }, [data.text]);

  if (!data.text || dismissed) return null;

  function close() {
    try {
      window.localStorage.setItem(dismissKey(data.text), "1");
    } catch {
      /* игнорирай — dismiss-ът важи поне за сесията */
    }
    setDismissed(true);
  }

  const content = (
    /* line-clamp-2: дълъг текст се пренася на 2 реда вместо да се отрязва
       по средата на дума (беше truncate = 1 ред + „…"). */
    <span className="line-clamp-2 text-sm font-medium leading-snug">{data.text}</span>
  );

  /* Фон = --sf-text, текст = --sf-bg: тази двойка ГАРАНТИРА контраст на всяка
     тема (за разлика от --sf-primary + бяло — нечетимо при светъл акцент). */
  return (
    <div className="relative flex min-h-9 w-full items-center justify-center gap-3 bg-(--sf-text) px-10 py-1.5 text-center text-(--sf-bg)">
      {safeHref(data.href) ? (
        <Link href={safeHref(data.href)} className="underline-offset-2 hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
      <button
        type="button"
        aria-label="Скрий съобщението"
        onClick={close}
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-(--sf-bg) opacity-70 transition-opacity hover:opacity-100"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
