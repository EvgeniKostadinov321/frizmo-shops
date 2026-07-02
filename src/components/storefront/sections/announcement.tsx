import Link from "next/link";
import type { SectionOfType } from "@/schemas/site-settings";

export function AnnouncementSection({ data }: { data: SectionOfType<"announcement">["data"] }) {
  if (!data.text) return null;
  const content = <span className="text-sm font-medium">{data.text}</span>;

  return (
    <div className="w-full bg-(--sf-primary) px-4 py-2 text-center text-white">
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
