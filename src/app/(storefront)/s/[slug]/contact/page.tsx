import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactMapSection } from "@/components/storefront/sections/contact-map";
import { ContactForm } from "@/components/storefront/contact-form";
import type { SectionContext } from "@/components/storefront/sections";
import { getPublicShop } from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  const desc = `Свържи се с ${result.shop.name} — телефон, имейл и адрес.`;
  return {
    title: `Контакти — ${result.shop.name}`,
    description: desc,
    openGraph: { title: `Контакти — ${result.shop.name}`, description: desc },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings } = result;

  const ctx: SectionContext = {
    shop,
    base: `/s/${shop.slug}`,
    productsBySection: {},
    categories: [],
    categoryCovers: {},
  };

  /* Търговецът е избрал композиция на секцията на началната страница —
     страницата „Контакти" я уважава (иначе дефолт). */
  const homeSection = settings.sections.find((s) => s.type === "contact-map");
  const data =
    homeSection?.type === "contact-map"
      ? { ...homeSection.data, title: homeSection.data.title || "Контакти" }
      : { variant: 1 as const, title: "Контакти", showMap: true };

  return (
    <div className="py-2">
      <ContactMapSection data={data} ctx={ctx} />
      {/* Форма за съобщение — само ако търговецът има имейл (иначе няма къде
          да отиде съобщението). */}
      {shop.email && (
        <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:pb-20">
          <div className="mb-6 text-center">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
              Пиши ни
            </p>
            <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-(--sf-text)">
              Имаш въпрос?
            </h2>
          </div>
          <ContactForm slug={shop.slug} />
        </div>
      )}
    </div>
  );
}
