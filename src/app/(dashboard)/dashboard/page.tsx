import Link from "next/link";
import { Badge, Card, LinkButton } from "@/components/ui";
import { DashboardWelcome } from "@/components/dashboard/dashboard-welcome";
import { countCategories } from "@/db/queries/categories";
import { countNewOrders, getMonthRevenue } from "@/db/queries/orders";
import { countProducts } from "@/db/queries/products";
import { getOwnShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Табло — Frizmo Shops" };

export default async function DashboardPage() {
  const { shop } = await getOwnShop();

  if (!shop) {
    return <DashboardWelcome />;
  }

  const [productCount, categoryCount, newOrders, monthRevenue] = await Promise.all([
    countProducts(shop.id),
    countCategories(shop.id),
    countNewOrders(shop.id),
    getMonthRevenue(shop.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">Табло</h1>
        <LinkButton href="/dashboard/products/new">Нов продукт</LinkButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/orders?status=new">
          <Card className="h-full transition-colors hover:border-brand-500">
            <p className="text-sm text-ink-500">Нови поръчки</p>
            <p className="mt-2 text-3xl font-bold text-ink-900">{newOrders}</p>
          </Card>
        </Link>

        <Card>
          <p className="text-sm text-ink-500">Приходи този месец</p>
          <p className="mt-2 text-3xl font-bold text-ink-900">{formatPrice(monthRevenue)}</p>
        </Card>

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
