import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import { GalleryGrid } from "../gallery-lightbox";
import { SectionShell, type SectionTone } from "./shared";

export function GallerySection({
  data,
  tone,
}: {
  data: SectionOfType<"gallery">["data"];
  tone?: SectionTone;
}) {
  const paths = data.imagePaths;
  if (paths.length === 0) return null;
  const urls = paths.map(publicImageUrl);

  /* Вариант 1 = адаптивна мозайка (1–2 → дует, 3+ → masonry);
     2 = филмова лента; 3 = движеща се стена. Кликът винаги отваря lightbox. */
  const grid =
    data.variant === 2
      ? ("strip" as const)
      : data.variant === 3
        ? ("wall" as const)
        : paths.length <= 2
          ? ("duo" as const)
          : ("masonry" as const);

  return (
    <SectionShell kicker="Галерия" title={data.title || "Галерия"} tone={tone}>
      <GalleryGrid urls={urls} variant={grid} />
    </SectionShell>
  );
}
