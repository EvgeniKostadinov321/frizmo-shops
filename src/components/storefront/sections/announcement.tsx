import Link from "next/link";
import type { SectionOfType } from "@/schemas/site-settings";

export function AnnouncementSection({ data }: { data: SectionOfType<"announcement">["data"] }) {
  if (!data.text) return null;
  const content = <span className="text-sm font-medium">{data.text}</span>;

  /* Фон = --sf-text, текст = --sf-bg: тази двойка ГАРАНТИРА контраст на всяка тема
     (за разлика от --sf-primary + бяло, което е нечетимо при светъл акцент напр.
     неоновото жълто на „Пулс"). */
  /* Фиксирана височина (h-9 = 2.25rem) — влиза в --sf-chrome сметката на
     layout-а, за да покрива hero-то точно екрана. Дълъг текст се отрязва. */
  return (
    <div className="flex h-9 w-full items-center justify-center overflow-hidden bg-(--sf-text) px-4 text-center text-(--sf-bg)">
      {data.href ? (
        <Link href={data.href} className="truncate underline-offset-2 hover:underline">
          {content}
        </Link>
      ) : (
        <span className="truncate">{content}</span>
      )}
    </div>
  );
}
