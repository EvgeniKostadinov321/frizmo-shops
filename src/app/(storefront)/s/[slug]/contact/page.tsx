import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactMapSection } from "@/components/storefront/sections/contact-map";
import type { SectionContext } from "@/components/storefront/sections";
import { getPublicShop } from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { title: `Контакти — ${result.shop.name}` };
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
    </div>
  );
}
