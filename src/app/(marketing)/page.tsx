import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BeforeAfter } from "@/components/marketing/before-after";
import { CategoryMarquee } from "@/components/marketing/category-marquee";
import { ChaosWord } from "@/components/marketing/chaos-word";
import { DeletedAccountToast } from "@/components/marketing/deleted-account-toast";
import { DoneForYou } from "@/components/marketing/done-for-you";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { FeeCalculator } from "@/components/marketing/fee-calculator";
import { HeroStorefrontDemo } from "@/components/marketing/hero-storefront-demo";
import { InstallAppButton } from "@/components/marketing/install-app-button";
import { InstallAppSection } from "@/components/marketing/install-app-section";
import { Reveal } from "@/components/marketing/reveal";
import { RevealList } from "@/components/marketing/reveal-list";
import { ShevitsaDivider } from "@/components/marketing/shevitsa-divider";
import { ShopCard } from "@/components/marketing/shop-card";
import { StepCard, type StepVisual } from "@/components/marketing/step-card";
import { Accordion, Icon } from "@/components/ui";
import { searchShops } from "@/db/queries/catalog";
import { jsonLdHtml } from "@/lib/json-ld";
import { PRICING_PLANS, PRICING_TRUST, FEE_NOTE } from "@/lib/plans-content";

export const metadata: Metadata = {
  title: "Frizmo Shops — Продавай повече. Без хаос.",
  description:
    "Истински онлайн магазин със собствен адрес за минути: продукти, поръчки, наличности и видимост в Google. Безплатен старт — плащаш малка такса само при продажба.",
  /* Началната страница е достъпна и на / и на /?query — каноничният вариант е коренът
     (каталожните и магазинните страници вече имат свой canonical). */
  alternates: { canonical: "/" },
};

const STEPS: { number: string; title: string; text: string; visual: StepVisual }[] = [
  {
    number: "01",
    title: "Регистрирай се",
    text: "Име на магазина, категория — и си вътре. Без ангажимент, без договори.",
    visual: "register",
  },
  {
    number: "02",
    title: "Добави продукти",
    text: "Снимки, цени, варианти (размер, цвят, разфасовка) — колкото ти трябват.",
    visual: "products",
  },
  {
    number: "03",
    title: "Избери визия",
    text: "Теми, твоите цветове, подреждаеми секции. Целият сайт се преоцветява с един клик.",
    visual: "theme",
  },
  {
    number: "04",
    title: "Публикувай",
    text: "Един клик — и магазинът е на живо. Сподели линка, клиентите поръчват веднага.",
    visual: "publish",
  },
];

const FAQ = [
  { value: "company", question: "Трябва ли ми фирма, за да продавам?", answer: "За редовна търговска дейност — да (ЕООД, ЕТ или регистрация като земеделски производител/занаятчия). Ако тепърва проучваш, започни безплатния период и говори със счетоводител." },
  { value: "payment", question: "Как клиентите плащат?", answer: "Наложен платеж, банков превод или на място — ти избираш кои методи предлагаш. Плащане с карта идва скоро." },
  { value: "cancel", question: "Мога ли да откажа по всяко време?", answer: "Да. Без договори и без неустойки — спираш когато решиш и толкова." },
  { value: "speed", question: "Колко бързо мога да започна?", answer: "Първият ти продукт може да е онлайн 10 минути след регистрацията. Сериозно." },
  { value: "commission", question: "Има ли такса?", answer: "Създаването на магазина е безплатно — без месечен абонамент. Взимаме 5% при реална продажба (минимум 0,30 евро, максимум 50 евро на поръчка). Плащаш само когато и ти печелиш." },
  { value: "fee-collection", question: "Как се плаща таксата?", answer: "Парите от продажбите отиват директно при теб — ние не ги пипаме. Таксите от месеца се събират и в началото на следващия ти издаваме една обща фактура, която се плаща с карта. Картата се въвежда еднократно, чак след първата ти продажба. При върната поръчка таксата се приспада от следващата фактура." },
];

/** Letterspaced editorial kicker с hairline продължение. */
function Kicker({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.24em] ${
        dark ? "text-brand-surface-muted" : "text-ink-500"
      }`}
    >
      <span className="shrink-0">{children}</span>
      <span aria-hidden className={`h-px flex-1 ${dark ? "bg-brand-surface-ink/15" : "bg-surface-200"}`} />
    </p>
  );
}

export default async function LandingPage() {
  /* „На живо" показва РЕАЛНИ публикувани магазини (решение 2026-07-25 — без
     демо seed на прод). Празна база → секцията просто липсва; самонапълва се
     с идването на първите търговци. searchShops крие тестовите магазини;
     витрината иска и cover снимка — магазин без продуктова фотография не е
     представителен (крие и e2e остатъци в dev базата). */
  const { items: liveShops } = await searchShops({});
  const showcaseShops = liveShops.filter((shop) => shop.coverImage).slice(0, 3);

  return (
    <>
      <DeletedAccountToast />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Frizmo Shops",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: "Платформа за създаване на онлайн магазини за българския пазар.",
            /* Безплатен вход (монетизация 2026-07-23 = такса на продажба, не абонамент).
               price:0 отразява видимото „Безплатно" — стара цена 10€ в JSON-LD беше подвеждаща
               за Google Rich Results (одит #4 SEO-02). */
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }),
        }}
      />

      {/* Hero + marquee запълват ТОЧНО първия екран на desktop: общ flex контейнер
          с височина 100svh − хедъра (pt-3 + h-14 = 4.25rem); hero е flex-1, а
          marquee-то ляга на долния ръб — без процеп към тъмната секция. */}
      <div className="flex flex-col lg:min-h-[calc(100svh-4.25rem)]">
      <section
        className="relative flex items-center overflow-hidden lg:flex-1"
        style={{ backgroundImage: "var(--gradient-hero-glow)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-12 md:pt-16 lg:py-12">
          {/* Мобилен ред: текст → витрина → чеклист; desktop: текст+чеклист вляво, витрина вдясно */}
          <div className="grid items-center gap-x-16 gap-y-12 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-[auto_auto]">
            <div className="flex flex-col items-start gap-6 lg:row-start-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0 px-3.5 py-1.5 text-xs font-semibold text-ink-700 shadow-card">
                <span className="size-1.5 rounded-full bg-brand-600" aria-hidden />
                Направено за българските търговци
              </span>
              <h1 className="font-display text-5xl font-extrabold leading-[1.03] tracking-tight text-balance text-ink-900 sm:text-6xl lg:text-[4.5rem]">
                Продавай повече.
                <br />
                Без{" "}
                <span className="text-brand-600">
                  <ChaosWord />
                </span>
                .
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-ink-700">
                Истински онлайн магазин със собствен адрес — продукти, поръчки, наличности
                и клиенти, които те намират в Google. Спри да гониш поръчки из чатовете.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/auth/register?role=seller"
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink-900 px-7 text-base font-bold text-surface-0 shadow-card transition-transform hover:-translate-y-0.5"
                >
                  Създай магазина си безплатно
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
                <InstallAppButton />
              </div>
            </div>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <HeroStorefrontDemo />
            </div>

            <div className="pt-2 lg:col-start-1 lg:row-start-2 lg:pt-0">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500">
                {["Безплатен старт", "Без месечна такса", "Готов за 15 минути", "Плащаш при продажба"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Icon name="check" size={15} className="shrink-0 text-brand-600" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              {/* Шевицата — националният подпис; само тук и на финалния CTA */}
              <ShevitsaDivider id="shevitsa-hero" className="mt-6 max-w-56 text-brand-600/40" />
            </div>
          </div>
        </div>
      </section>

      {/* „Улицата на пазара" — какво се продава с Frizmo Shops */}
      <CategoryMarquee />
      </div>

      {/* Болката — ТЪМНИЯТ момент: чат хаосът се разиграва, магазинът „изгрява" */}
      <section
        className="relative overflow-hidden bg-brand-surface"
        style={{ backgroundImage: "var(--gradient-cta)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ backgroundImage: "var(--texture-noise)" }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24">
          <div className="max-w-2xl">
            <Kicker dark>Познато ли ти е</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-brand-surface-ink sm:text-5xl">
              Продаваш през Facebook и Viber?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-surface-muted">
              Всеки ден едни и същи въпроси в чата, изгубени поръчки и продукти, които
              никой не намира. Има по-добър начин.
            </p>
          </div>
          <div className="mt-14">
            <BeforeAfter />
          </div>
        </div>
      </section>

      {/* Как работи — стъпки с мини-визуализации и свързваща пунктирана линия */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="max-w-2xl">
          <Kicker>Как работи</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
            От нула до първата поръчка.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">
            Без код, без дизайнер, без чакане. Четири стъпки — и магазинът ти е на живо на
            твоя адрес във frizmoshops.bg.
          </p>
        </div>
        <div className="relative mt-14">
          {/* Свързваща линия зад номерата — вижда се само в процепите между картите */}
          <div
            aria-hidden
            className="absolute inset-x-10 top-[2.35rem] hidden border-t-2 border-dashed border-surface-300 lg:block"
          />
          <RevealList className="relative z-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            {STEPS.map((step) => (
              <StepCard
                key={step.number}
                number={step.number}
                title={step.title}
                text={step.text}
                visual={step.visual}
              />
            ))}
          </RevealList>
        </div>
      </section>

      {/* Витрина: реални магазини, направени с Frizmo Shops */}
      {showcaseShops.length > 0 && (
        <section className="bg-surface-100/60">
          <div className="mx-auto w-full max-w-7xl px-4 py-24">
            <Kicker>На живо</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
              Виж как изглежда на живо
            </h2>
            <p className="mt-3 text-lg text-ink-500">
              Истински магазини, направени с Frizmo Shops — кликни и разгледай.
            </p>
            <RevealList className="mt-12 grid gap-6 md:grid-cols-3">
              {showcaseShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} coverImage={shop.coverImage} />
              ))}
            </RevealList>
            <p className="mt-10">
              <Link
                href="/shops"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Разгледай всички магазини в каталога
                <span aria-hidden>→</span>
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* Функции — bento grid с живата преоцветяваща витрина */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="max-w-2xl">
          <Kicker>Какво получаваш</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
            Всичко за онлайн продажбите — на едно място.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">
            Дизайн, поръчки и видимост в Google. Ти се грижиш за продуктите, останалото е
            наша работа.
          </p>
        </div>
        <Reveal className="mt-14">
          <FeatureBento />
        </Reveal>
      </section>

      {/* Инсталирай като приложение (PWA) */}
      <InstallAppSection />

      {/* Цени — картата + „касовата бележка" (интерактивният калкулатор) */}
      <section id="pricing" className="bg-surface-100/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-24">
          <Kicker>Цени</Kicker>
          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
            Прости, честни цени
          </h2>
          <p className="mt-3 max-w-3xl text-lg text-ink-500">{FEE_NOTE}</p>
          <div className="mx-auto mt-12 grid max-w-4xl items-center gap-10 lg:grid-cols-2">
            <RevealList className="grid min-w-0 gap-6" itemClassName="h-full min-w-0">
              {PRICING_PLANS.map((plan) => {
                const dark = plan.highlighted;
                return (
                  <div
                    key={plan.id}
                    className={`flex h-full flex-col gap-6 rounded-card p-8 ${
                      dark
                        ? "bg-linear-to-br from-brand-surface to-brand-surface-deep text-brand-surface-ink [box-shadow:var(--shadow-brand-tint),var(--shadow-float)]"
                        : "border border-surface-200 bg-surface-0 shadow-card"
                    }`}
                  >
                    <div>
                      <h3 className={`font-display text-2xl font-extrabold ${dark ? "" : "text-ink-900"}`}>
                        {plan.name}
                      </h3>
                      <p className={`mt-1 text-sm ${dark ? "text-brand-surface-muted" : "text-ink-500"}`}>
                        {plan.description}
                      </p>
                    </div>
                    <div>
                      <p className={`font-display text-5xl font-extrabold sm:text-6xl ${dark ? "" : "text-ink-900"}`}>
                        {plan.priceLabel}
                      </p>
                      <p
                        className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${dark ? "text-brand-surface-muted" : "text-brand-600"}`}
                      >
                        <Icon name="check" size={13} className="shrink-0" />
                        Без начално плащане · 5% само при продажба
                      </p>
                    </div>
                    <ul
                      className={`flex flex-col gap-2.5 text-sm ${dark ? "text-brand-surface-ink/90" : "text-ink-700"}`}
                    >
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <Icon
                            name="check"
                            size={15}
                            className={`shrink-0 ${dark ? "text-brand-surface-muted" : "text-brand-600"}`}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/register?role=seller"
                      className={`mt-auto inline-flex h-12 items-center justify-center rounded-full text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                        dark
                          ? "bg-brand-surface-ink text-brand-surface"
                          : "bg-ink-900 text-surface-0"
                      }`}
                    >
                      Започни безплатно
                    </Link>
                  </div>
                );
              })}
            </RevealList>
            <Reveal>
              <FeeCalculator />
            </Reveal>
          </div>
          <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink-500">
            {PRICING_TRUST.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Icon name="check" size={15} className="shrink-0 text-brand-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* „Ние ще го направим за теб" — преди FAQ: улавя колебаещите се */}
      <DoneForYou />

      {/* FAQ — split: заглавие + контакт карта вляво, акордеон вдясно */}
      <section className="mx-auto w-full max-w-7xl px-4 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Kicker>Въпроси</Kicker>
            <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-balance text-ink-900 sm:text-5xl">
              Често задавани въпроси
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-700">
              Отговорите на най-честите въпроси. Не намираш това, което търсиш?
            </p>
            <div className="mt-6 flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-5 shadow-card">
              <p className="font-bold text-ink-900">Питай ни директно</p>
              <a
                href="mailto:supportfrizmo@gmail.com"
                className="flex items-center gap-3 text-sm font-medium text-ink-700 transition-colors hover:text-brand-600"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon name="mail" size={16} />
                </span>
                supportfrizmo@gmail.com
              </a>
            </div>
          </div>
          <div>
            <Accordion items={FAQ} />
          </div>
        </div>
      </section>

      {/* Финален CTA — работилницата на златния час (Magnific, 2026-07-25) + тъмен scrim */}
      <section className="relative overflow-hidden bg-ink-900">
        <Image
          src="/landing/cta-workshop.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          aria-hidden
        />
        {/* Тъмен scrim — четимост на центрирания текст върху всяка част от снимката */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgb(16 18 16 / 0.82), rgb(16 18 16 / 0.66) 50%, rgb(16 18 16 / 0.72))",
          }}
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-7 px-4 py-28 text-center">
          <ShevitsaDivider id="shevitsa-cta" className="max-w-48 text-white/35" />
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-surface-200">
            Frizmo Shops
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Първата ти поръчка е по-близо,
            <br className="hidden sm:block" /> отколкото мислиш.
          </h2>
          <p className="max-w-xl text-lg text-surface-200">
            Регистрирай се за 2 минути. Ако не ти хареса — просто спираш. Безплатен старт, без месечна такса.
          </p>
          <Link
            href="/auth/register?role=seller"
            className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-8 text-base font-bold text-ink-900 shadow-float transition-transform hover:-translate-y-0.5"
          >
            Създай магазина си сега
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
