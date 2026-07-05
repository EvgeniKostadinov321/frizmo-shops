import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import { type ImageTextData, ImageTextBody, ImageTextCentered } from "./shared";

/**
 * Вариант 1 — разделени колони: снимката е вписана „картичка" с темовия подпис
 * (--sf-hero-radius арка / --sf-hero-frame рамка — третирането от hero split-а),
 * текстът — editorial блок, вертикално центриран.
 */
export function ImageTextSplit({ data }: { data: ImageTextData }) {
  const imageFirst = data.imageSide === "left";
  if (!data.imagePath) return <ImageTextCentered data={data} />;

  /* Подравняване с 72rem контейнера чрез max() — на външната страна на всяка
     колона; вътрешните страни делят въздух помежду си. */
  const textPad = imageFirst
    ? "px-4 py-14 md:py-20 md:pl-14 md:pr-[max(1rem,calc((100vw-72rem)/2+1rem))]"
    : "px-4 py-14 md:py-20 md:pr-14 md:pl-[max(1rem,calc((100vw-72rem)/2+1rem))]";
  const imagePad = imageFirst
    ? "md:py-12 md:pl-[max(1rem,calc((100vw-72rem)/2+1rem))]"
    : "md:py-12 md:pr-[max(1rem,calc((100vw-72rem)/2+1rem))]";

  return (
    <section className="grid w-full md:min-h-[60vh] md:grid-cols-2">
      <div className={`relative flex md:items-stretch ${imagePad} ${imageFirst ? "" : "md:order-2"}`}>
        <div className="sf-frame relative min-h-72 w-full overflow-hidden md:min-h-0 md:rounded-(--sf-hero-radius) md:[box-shadow:var(--sf-hero-frame)]">
          <Image
            src={publicImageUrl(data.imagePath)}
            alt={data.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className={`flex items-center ${imageFirst ? "" : "md:order-1"} ${textPad}`}>
        <div className="max-w-xl">
          <ImageTextBody data={data} />
        </div>
      </div>
    </section>
  );
}
