import Link from "next/link";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";
import { countCategories } from "@/db/queries/categories";
import { countProducts } from "@/db/queries/products";
import { getOwnShop } from "@/lib/auth";

export const metadata = { title: "Табло — Frizmo Shops" };

export default async function DashboardPage() {
  const { shop } = await getOwnShop();

  if (!shop) {
    return (
      <EmptyState
        icon="🏪"
        title="Създай магазина си за 2 минути"
        description="Име, категория и първи продукт — това е всичко, за да започнеш."
        action={
          <LinkButton size="lg" href="/dashboard/onboarding">
            Създай магазин
          </LinkButton>
        }
      />
    );
  }

  const [productCount, categoryCount] = await Promise.all([
    countProducts(shop.id),
    countCategories(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Табло</h1>
        <LinkButton href="/dashboard/products/new">Нов продукт</LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-500">Статус на магазина</p>
          <div className="mt-2">
            {shop.status === "draft" ? (
              <Badge tone="neutral">Чернова — очаква публикуване</Badge>
            ) : shop.status === "published" ? (
              <Badge tone="success">Публикуван</Badge>
            ) : (
              <Badge tone="danger">Временно затворен</Badge>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Публикуването на магазина идва със следващата стъпка от изграждането — таб
            „Уебсайт“.
          </p>
        </Card>

        <Link href="/dashboard/products">
          <Card className="h-full transition-colors hover:border-brand-500">
            <p className="text-sm text-ink-500">Продукти</p>
            <p className="mt-2 text-3xl font-bold text-ink-900">{productCount}</p>
          </Card>
        </Link>

        <Link href="/dashboard/categories">
          <Card className="h-full transition-colors hover:border-brand-500">
            <p className="text-sm text-ink-500">Категории</p>
            <p className="mt-2 text-3xl font-bold text-ink-900">{categoryCount}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
