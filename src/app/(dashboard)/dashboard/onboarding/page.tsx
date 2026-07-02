import Link from "next/link";
import { createShop } from "@/actions/shop";
import { ProductForm } from "@/components/dashboard/product-form";
import { ShopForm } from "@/components/dashboard/shop-form";
import { getOwnShop } from "@/lib/auth";

export const metadata = { title: "Създай магазина си — Frizmo Shops" };

function Progress({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center gap-2 text-sm">
      <span
        className={`flex size-7 items-center justify-center rounded-full font-medium ${
          step === 1 ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"
        }`}
      >
        1
      </span>
      <span className={step === 1 ? "font-medium text-ink-900" : "text-ink-500"}>Магазин</span>
      <span className="mx-2 h-px w-8 bg-surface-300" aria-hidden />
      <span
        className={`flex size-7 items-center justify-center rounded-full font-medium ${
          step === 2 ? "bg-brand-600 text-white" : "bg-surface-200 text-ink-500"
        }`}
      >
        2
      </span>
      <span className={step === 2 ? "font-medium text-ink-900" : "text-ink-500"}>
        Първи продукт
      </span>
    </div>
  );
}

export default async function OnboardingPage() {
  const { shop } = await getOwnShop();

  if (!shop) {
    return (
      <div className="mx-auto max-w-2xl">
        <Progress step={1} />
        <h1 className="mb-1 text-2xl font-bold text-ink-900">Да създадем магазина ти</h1>
        <p className="mb-6 text-ink-700">
          Попълни основното — всичко може да се променя по-късно.
        </p>
        <ShopForm mode="create" action={createShop} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Progress step={2} />
      <h1 className="mb-1 text-2xl font-bold text-ink-900">Добави първия си продукт</h1>
      <p className="mb-6 text-ink-700">
        Магазинът „{shop.name}“ е създаден! Добави първия продукт — детайли като
        характеристики и варианти можеш да добавиш по-късно.
      </p>
      <ProductForm simple categories={[]} redirectTo="/dashboard" />
      <p className="mt-4 text-center">
        <Link href="/dashboard" className="text-sm text-ink-500 hover:text-ink-900 hover:underline">
          Прескочи засега
        </Link>
      </p>
    </div>
  );
}
