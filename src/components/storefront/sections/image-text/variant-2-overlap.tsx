import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import { type ImageTextData, ImageTextBody, ImageTextCentered } from "./shared";

/**
 * Вариант 2 — застъпване: голяма снимка отзад, текстът в плаваща карта
 * (surface-raised + сянка), която ЗАСТЪПВА ръба на снимката — дълбочина и
 * асиметрия вместо разделени колони. На мобилно картата се качва върху долния
 * ръб на снимката (отрицателен margin) — застъпването се запазва.
 */
export function ImageTextOverlap({ data }: { data: ImageTextData }) {
  const imageFirst = data.imageSide === "left";
  if (!data.imagePath) return <ImageTextCentered data={data} />;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
      {/* Grid застъпване вместо absolute: двата елемента делят row-1 → редът
         (и секцията) растат с ПО-ВИСОКИЯ — дълъг текст не нахлува в съседните
         секции (R3 от одита). */}
      <div className="md:grid md:grid-cols-12 md:items-center">
        {/* Голямата снимка — ~2/3 ширина, на страната от настройката */}
        <div
          className={`sf-frame relative h-72 overflow-hidden rounded-(--sf-radius) sm:h-96 md:row-start-1 md:h-full md:min-h-128 ${
            imageFirst ? "md:col-start-1 md:col-end-9" : "md:col-start-5 md:col-end-13"
          }`}
        >
          <Image
            src={publicImageUrl(data.imagePath)}
            alt={data.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover"
          />
        </div>
        {/* Текст-картата — застъпва ръба на снимката (споделена колона) */}
        <div
          className={`relative z-10 -mt-12 mx-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-7 shadow-(--sf-shadow) sm:p-9 md:row-start-1 md:mx-0 md:my-10 ${
            imageFirst ? "md:col-start-8 md:col-end-13" : "md:col-start-1 md:col-end-6"
          }`}
        >
          <ImageTextBody data={data} />
        </div>
      </div>
    </section>
  );
}
