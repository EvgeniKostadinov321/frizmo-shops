import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicShop } from "@/db/queries/storefront";
import { legalSections } from "@/lib/legal-template";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return {
    title: `Условия — ${result.shop.name}`,
    robots: { index: false },
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1
        className="mb-8 text-3xl text-(--sf-text)"
      >
        Условия за пазаруване
      </h1>

      <div className="flex flex-col gap-8">
        {legalSections(shop).map((section) => (
          <section key={section.title}>
            <h2
              className="mb-2 text-xl text-(--sf-text)"
            >
              {section.title}
            </h2>
            <div className="flex flex-col gap-2 text-sm text-(--sf-muted)">
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
