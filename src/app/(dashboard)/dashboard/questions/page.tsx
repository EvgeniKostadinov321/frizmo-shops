import { QuestionsManager } from "@/components/dashboard/questions-manager";
import { getShopQuestions } from "@/db/queries/questions";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Въпроси — Frizmo Shops" };

export default async function QuestionsPage() {
  const { shop } = await requireShop();
  const items = await getShopQuestions(shop.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Въпроси</h1>
        <p className="mt-1 text-sm text-ink-500">
          Отговори на въпросите — публикуват се в магазина заедно с отговора.
        </p>
      </div>
      <QuestionsManager items={items} shopSlug={shop.slug} />
    </div>
  );
}
