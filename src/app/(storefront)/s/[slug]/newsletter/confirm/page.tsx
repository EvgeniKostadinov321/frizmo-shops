import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { getPublicShop } from "@/db/queries/storefront";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; action?: string }>;
}

export const metadata = { robots: { index: false } };

type Result = "confirmed" | "already" | "unsubscribed" | "invalid";

/** Обработва token-а: потвърждение (default) или отписване (?action=unsubscribe). */
async function process(
  shopId: string,
  token: string,
  action: string | undefined,
): Promise<Result> {
  if (!token) return "invalid";
  const row = await db.query.subscribers.findFirst({
    where: and(eq(subscribers.shopId, shopId), eq(subscribers.token, token)),
  });
  if (!row) return "invalid";

  if (action === "unsubscribe") {
    await db
      .update(subscribers)
      .set({ status: "unsubscribed", updatedAt: new Date() })
      .where(eq(subscribers.id, row.id));
    return "unsubscribed";
  }

  if (row.status === "confirmed") return "already";
  await db
    .update(subscribers)
    .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscribers.id, row.id));
  return "confirmed";
}

const MESSAGES: Record<Result, { title: string; text: string }> = {
  confirmed: {
    title: "Абонаментът е потвърден!",
    text: "Благодарим — вече ще получаваш новини и оферти.",
  },
  already: {
    title: "Вече си абониран",
    text: "Този имейл вече е потвърден. Няма нужда да правиш нищо.",
  },
  unsubscribed: {
    title: "Отписа се успешно",
    text: "Няма да получаваш повече имейли. Можеш да се абонираш пак по всяко време.",
  },
  invalid: {
    title: "Линкът е невалиден",
    text: "Линкът е грешен или изтекъл. Опитай да се абонираш отново от сайта.",
  },
};

export default async function NewsletterConfirmPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { token, action } = await searchParams;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop } = result;

  const outcome = await process(shop.id, token ?? "", action);
  const msg = MESSAGES[outcome];

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-(family-name:--sf-font-heading) text-3xl text-(--sf-text)">
        {msg.title}
      </h1>
      <p className="text-(--sf-muted)">{msg.text}</p>
      <Link
        href={`/s/${shop.slug}`}
        className="mt-2 inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
      >
        Към магазина
      </Link>
    </div>
  );
}
