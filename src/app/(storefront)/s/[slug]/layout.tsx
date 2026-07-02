import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontHeader } from "@/components/storefront/header";
import { getPublicShop } from "@/db/queries/storefront";
import { themeStyle } from "@/lib/themes";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings, viewerIsOwner } = result;

  return (
    <div
      style={themeStyle(settings)}
      className="flex min-h-screen flex-col bg-(--sf-bg) text-(--sf-text)"
    >
      {viewerIsOwner && shop.status !== "published" && (
        <div className="bg-warning-600 px-4 py-2 text-center text-sm font-medium text-white">
          Чернова — само ти виждаш тази страница.{" "}
          <Link href="/dashboard/website" className="underline">
            Продължи настройката
          </Link>
        </div>
      )}
      <StorefrontHeader shop={shop} settings={settings} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter shop={shop} settings={settings} />
    </div>
  );
}
