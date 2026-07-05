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

  /* 1–2 снимки: централен дует; 3+: masonry. Кликът отваря lightbox. */
  return (
    <SectionShell kicker="Галерия" title={data.title || "Галерия"} tone={tone}>
      <GalleryGrid urls={urls} variant={paths.length <= 2 ? "duo" : "masonry"} />
    </SectionShell>
  );
}
