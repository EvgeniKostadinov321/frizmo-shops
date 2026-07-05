import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import { Paragraphs } from "./shared";

/**
 * Editorial момент: снимката edge-to-edge до ръба на екрана (без карта-рамка),
 * текстът вертикално центриран и подравнен с контейнера на секциите.
 */
export function ImageTextSection({ data }: { data: SectionOfType<"image-text">["data"] }) {
  if (!data.text && !data.imagePath) return null;
  const imageFirst = data.imageSide === "left";

  /* Без снимка → центриран текстов блок (не полу-празен грид). */
  if (!data.imagePath) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {data.title && (
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
              {data.title}
            </h2>
          )}
          <div className="flex flex-col gap-3 text-lg leading-relaxed text-(--sf-muted)">
            <Paragraphs text={data.text} />
          </div>
        </div>
      </section>
    );
  }

  /* Текстовият padding се подравнява с 72rem контейнера чрез max(). */
  const textPad = imageFirst
    ? "px-4 py-14 md:py-20 md:pl-14 md:pr-[max(1rem,calc((100vw-72rem)/2+1rem))]"
    : "px-4 py-14 md:py-20 md:pr-14 md:pl-[max(1rem,calc((100vw-72rem)/2+1rem))]";

  return (
    <section className="grid w-full md:min-h-[60vh] md:grid-cols-2">
      <div className={`relative min-h-72 md:min-h-0 ${imageFirst ? "" : "md:order-2"}`}>
        <Image
          src={publicImageUrl(data.imagePath)}
          alt={data.title || ""}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      <div className={`flex items-center ${imageFirst ? "" : "md:order-1"} ${textPad}`}>
        <div className="flex max-w-xl flex-col gap-5">
          {data.title && (
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
              {data.title}
            </h2>
          )}
          <div className="flex flex-col gap-3 text-lg leading-relaxed text-(--sf-muted)">
            <Paragraphs text={data.text} />
          </div>
        </div>
      </div>
    </section>
  );
}
