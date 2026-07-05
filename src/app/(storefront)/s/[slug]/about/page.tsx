import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
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

/**
 * Editorial „За нас": kicker + display заглавие, водеща снимка с ТЕМОВАТА
 * hero рамка (арката на Ателие, неоновият блок на Пулс…), drop cap на първия
 * параграф. Историята на търговеца заслужава страница с глас, не сив блок.
 */
export default async function AboutPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings } = result;

  const text = settings.aboutText || shop.description;
  const [lead, ...rest] = settings.aboutImagePaths;
  const paragraphs = (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-14">
      <header className="mb-10 text-center">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
          Нашата история
        </p>
        <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.05] text-(--sf-text)">
          {shop.name}
        </h1>
      </header>

      {lead && (
        <div className="mb-12 flex justify-center">
          <div
            className="sf-frame relative aspect-4/3 w-full max-w-2xl overflow-hidden shadow-(--sf-shadow) [border-radius:var(--sf-hero-radius)] [box-shadow:var(--sf-hero-frame)]"
          >
            <Image
              src={publicImageUrl(lead)}
              alt={shop.name}
              fill
              sizes="(max-width: 768px) 100vw, 42rem"
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}

      {paragraphs.length > 0 ? (
        <div className="mx-auto flex max-w-prose flex-col gap-5 text-[1.0625rem] leading-relaxed text-(--sf-text)">
          {paragraphs.map((part, i) => (
            <p
              key={i}
              className={`whitespace-pre-line ${
                i === 0
                  ? "first-letter:float-left first-letter:mr-2 first-letter:text-[3.2em] first-letter:leading-[0.85] first-letter:font-(family-name:--sf-font-heading) first-letter:font-(--sf-heading-weight) first-letter:text-(--sf-primary)"
                  : ""
              }`}
            >
              {part}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-center text-(--sf-muted)">
          {shop.name} все още не е добавил представяне.
        </p>
      )}

      {rest.length > 0 && (
        <div className={`mt-12 grid gap-4 ${rest.length === 1 ? "justify-center" : "sm:grid-cols-2"}`}>
          {rest.map((path) => (
            <div
              key={path}
              className="sf-frame relative aspect-video w-full max-w-2xl overflow-hidden rounded-(--sf-radius) shadow-(--sf-shadow)"
            >
              <Image
                src={publicImageUrl(path)}
                alt={shop.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
