import { updateShop } from "@/actions/shop";
import { ShopForm } from "@/components/dashboard/shop-form";
import { Badge, Card } from "@/components/ui";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Магазин — Frizmo Shops" };

const statusLabels: Record<string, { label: string; tone: "neutral" | "success" | "danger" }> = {
  draft: { label: "Чернова — още не е публикуван", tone: "neutral" },
  published: { label: "Публикуван", tone: "success" },
  suspended: { label: "Временно затворен", tone: "danger" },
  blocked: { label: "Блокиран", tone: "danger" },
};

export default async function StorePage() {
  const { shop } = await requireShop();
  const workingHours = (shop.workingHours as { text?: string } | null) ?? {};
  const socialLinks = (shop.socialLinks as { facebook?: string; instagram?: string } | null) ?? {};
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

      <ShopForm
        mode="edit"
        action={updateShop}
        initial={{
          name: shop.name,
          businessCategory: shop.businessCategory,
          description: shop.description,
          city: shop.city ?? "",
          address: shop.address ?? "",
          phone: shop.phone ?? "",
          email: shop.email ?? "",
          workingHoursText: workingHours.text ?? "",
          facebook: socialLinks.facebook ?? "",
          instagram: socialLinks.instagram ?? "",
        }}
      />
    </div>
  );
}
