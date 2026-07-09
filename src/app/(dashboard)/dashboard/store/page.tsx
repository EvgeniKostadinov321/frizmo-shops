import { updateShop } from "@/actions/shop";
import { CopyButton } from "@/components/dashboard/copy-button";
import { ShopForm } from "@/components/dashboard/shop-form";
import { Badge, Card } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { parseWorkingHours } from "@/lib/working-hours";

export const metadata = { title: "Магазин — Frizmo Shops" };

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://frizmo-shops.vercel.app";

const statusLabels: Record<string, { label: string; tone: "neutral" | "success" | "danger" }> = {
  draft: { label: "Чернова — още не е публикуван", tone: "neutral" },
  published: { label: "Публикуван", tone: "success" },
  suspended: { label: "Временно затворен", tone: "danger" },
  blocked: { label: "Блокиран", tone: "danger" },
};

export default async function StorePage() {
  const { shop } = await requireShop();
  const socialLinks =
    (shop.socialLinks as {
      facebook?: string;
      instagram?: string;
      tiktok?: string;
      youtube?: string;
      viber?: string;
    } | null) ?? {};
  const status = statusLabels[shop.status] ?? statusLabels.draft!;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{shop.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            Публичен адрес: <span className="font-mono">/s/{shop.slug}</span>
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card>

      {shop.status === "published" && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-ink-900">Product feed за реклами</h2>
            <p className="text-sm text-ink-500">
              Дай този линк на Google Merchant или Facebook каталог, за да рекламираш
              продуктите си.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-control border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-ink-700">
              {BASE_URL}/s/{shop.slug}/feed.xml
            </code>
            <CopyButton value={`${BASE_URL}/s/${shop.slug}/feed.xml`} label="Копирай линка" />
          </div>
        </Card>
      )}

      <ShopForm
        mode="edit"
        action={updateShop}
        slug={shop.slug}
        initial={{
          name: shop.name,
          businessCategory: shop.businessCategory,
          description: shop.description,
          city: shop.city ?? "",
          address: shop.address ?? "",
          phone: shop.phone ?? "",
          email: shop.email ?? "",
          workingDays: parseWorkingHours(shop.workingHours),
          facebook: socialLinks.facebook ?? "",
          instagram: socialLinks.instagram ?? "",
          tiktok: socialLinks.tiktok ?? "",
          youtube: socialLinks.youtube ?? "",
          viber: socialLinks.viber ?? "",
        }}
      />
    </div>
  );
}
