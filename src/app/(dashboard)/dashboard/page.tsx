import { Card } from "@/components/ui";

export const metadata = { title: "Табло — Frizmo Shops" };

export default function DashboardPage() {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-ink-900">Добре дошъл!</h1>
      <p className="mt-2 text-ink-700">
        Тук ще създадеш своя онлайн магазин. Следващата стъпка от изграждането на
        платформата: създаване на магазин (План 2).
      </p>
    </Card>
  );
}
