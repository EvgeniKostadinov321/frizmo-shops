import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/storefront/page-header";
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

/**
 * Условия за пазаруване — editorial: PageHeader + номерирани секции с display
 * цифри и hairline разделители. Клиентът стига дотук от checkout-а (момент на
 * доверие) — страницата говори с гласа на темата, не като генериран документ.
 */
export default async function TermsPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings } = result;

  const sections = legalSections(shop, settings.legalOverrides);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <PageHeader
        kicker="Правна информация"
        title="Условия за пазаруване"
        intro={`Как работи пазаруването при ${shop.name} — доставка, плащане и връщане.`}
      />

      <div className="flex flex-col">
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            className="grid scroll-mt-24 gap-x-6 gap-y-2 border-b border-(--sf-border) py-7 last:border-b-0 sm:grid-cols-[3rem_1fr]"
          >
            <span
              aria-hidden
              className="text-2xl leading-none text-(--sf-primary) opacity-60 font-(family-name:--sf-font-heading) font-(--sf-heading-weight)"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="mb-2.5 text-xl text-(--sf-text)">{section.title}</h2>
              <div className="flex flex-col gap-2.5 leading-relaxed text-(--sf-text)/85">
                {section.paragraphs.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
