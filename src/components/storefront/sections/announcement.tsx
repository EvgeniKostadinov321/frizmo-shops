import Link from "next/link";
import type { SectionOfType } from "@/schemas/site-settings";

export function AnnouncementSection({ data }: { data: SectionOfType<"announcement">["data"] }) {
  if (!data.text) return null;
  const content = <span className="text-sm font-medium">{data.text}</span>;

  /* Фон = --sf-text, текст = --sf-bg: тази двойка ГАРАНТИРА контраст на всяка тема
     (за разлика от --sf-primary + бяло, което е нечетимо при светъл акцент напр.
     неоновото жълто на „Пулс"). */
  return (
    <div className="w-full bg-(--sf-text) px-4 py-2 text-center text-(--sf-bg)">
      {data.href ? (
        <Link href={data.href} className="underline-offset-2 hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
