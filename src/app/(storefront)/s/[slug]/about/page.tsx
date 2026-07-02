import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Paragraphs } from "@/components/storefront/sections/shared";
import { getPublicShop } from "@/db/queries/storefront";
import { publicImageUrl } from "@/lib/storage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `За нас — ${result.shop.name}` };
}

export default async function AboutPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings } = result;

  const text = settings.aboutText || shop.description;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1
        className="mb-6 text-3xl text-(--sf-text)"
      >
        За нас
      </h1>

      {settings.aboutImagePaths.length > 0 && (
        <div
          className={`mb-8 grid gap-3 ${
            settings.aboutImagePaths.length === 1 ? "" : "sm:grid-cols-2"
          }`}
        >
          {settings.aboutImagePaths.map((path) => (
            <div key={path} className="relative aspect-video overflow-hidden rounded-(--sf-radius)">
              <Image
                src={publicImageUrl(path)}
                alt={`${shop.name}`}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {text ? (
        <div className="flex max-w-prose flex-col gap-4 text-(--sf-muted)">
          <Paragraphs text={text} />
        </div>
      ) : (
        <p className="text-(--sf-muted)">{shop.name} все още не е добавил представяне.</p>
      )}
    </div>
  );
}
