import Image from "next/image";
import Link from "next/link";
import { createShop } from "@/actions/shop";
import { OnboardingProgress } from "@/components/dashboard/onboarding-progress";
import { ProductForm } from "@/components/dashboard/product-form";
import { ShopWizard } from "@/components/dashboard/shop-wizard";
import { getOwnShop } from "@/lib/auth";

export const metadata = { title: "Създай магазина си — Frizmo Shops" };

/** Заглавен блок в „Пазарен ден" ритъм: маскот-водач + kicker + display заглавие. */
function OnboardingHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <Image
        src="/bee-wave.png"
        alt=""
        aria-hidden
        width={160}
        height={160}
        priority
        className="hidden size-16 shrink-0 select-none sm:block"
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          {kicker}
        </p>
        <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight text-ink-900">
          {title}
        </h1>
        <p className="text-pretty text-ink-700">{children}</p>
      </div>
    </div>
  );
}

export default async function OnboardingPage() {
  const { shop } = await getOwnShop();

  if (!shop) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <OnboardingProgress step={1} />
        <OnboardingHeader kicker="Твоят магазин" title="Да създадем магазина ти">
          Попълни основното — контактите и работното време можеш да добавиш сега
          или по-късно.
        </OnboardingHeader>
        <ShopWizard action={createShop} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <OnboardingProgress step={2} />
      <OnboardingHeader kicker="Първи продукт" title="Добави първия си продукт">
        Магазинът „{shop.name}“ е създаден! Добави първия продукт — детайли като
        характеристики и варианти можеш да добавиш по-късно.
      </OnboardingHeader>
      <ProductForm simple categories={[]} sizeGuides={[]} redirectTo="/dashboard" />
      <p className="text-center">
        <Link
          href="/dashboard"
          className="text-sm text-ink-500 hover:text-ink-900 hover:underline"
        >
          Прескочи засега
        </Link>
      </p>
    </div>
  );
}
