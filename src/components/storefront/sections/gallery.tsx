import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell } from "./shared";

export function GallerySection({ data }: { data: SectionOfType<"gallery">["data"] }) {
  if (data.imagePaths.length === 0) return null;

  return (
    <SectionShell title={data.title || "Галерия"}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data.imagePaths.map((path) => (
          <div key={path} className="relative aspect-square overflow-hidden rounded-(--sf-radius)">
            <Image
              src={publicImageUrl(path)}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform hover:scale-105"
            />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
