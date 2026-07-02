import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import { Paragraphs } from "./shared";

export function ImageTextSection({ data }: { data: SectionOfType<"image-text">["data"] }) {
  if (!data.text && !data.imagePath) return null;
  const imageFirst = data.imageSide === "left";

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2">
      {data.imagePath && (
        <div
          className={`relative aspect-4/3 overflow-hidden rounded-(--sf-radius) ${
            imageFirst ? "" : "md:order-2"
          }`}
        >
          <Image
            src={publicImageUrl(data.imagePath)}
            alt={data.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      )}
      <div className={`flex flex-col gap-3 ${imageFirst ? "" : "md:order-1"}`}>
        {data.title && (
          <h2
            className="text-2xl text-(--sf-text)"
            style={{ fontWeight: "var(--sf-heading-weight)" as never }}
          >
            {data.title}
          </h2>
        )}
        <div className="flex flex-col gap-3 text-(--sf-muted)">
          <Paragraphs text={data.text} />
        </div>
      </div>
    </section>
  );
}
