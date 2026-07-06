"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCategory } from "@/actions/categories";
import { saveProduct } from "@/actions/products";
import {
  publishShop,
  publishSiteSettings,
  saveSiteSettings,
  setShopLogo,
} from "@/actions/site-settings";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { Button, Icon, Input, Spinner } from "@/components/ui";
import {
  buildRecipeSections,
  CATEGORY_SUGGESTIONS,
  THEME_PALETTES,
  type Palette,
} from "@/lib/site-recipes";
import { recommendedThemesFor } from "@/lib/themes";
import { publicImageUrl } from "@/lib/storage";
import type { BusinessCategory } from "@/schemas/shop";
import { siteSettingsSchema, THEMES, type ThemeId } from "@/schemas/site-settings";
import { ThemeCarousel } from "./theme-carousel";

const SUPPORT_EMAIL = "supportfrizmo@gmail.com";

interface WizardShop {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string;
  businessCategory: string;
  logoPath: string | null;
}

interface DraftProduct {
  name: string;
  price: string;
  images: string[];
}

/** Персистираният прогрес (localStorage) — качените файлове са в Storage. */
interface WizardState {
  step: number;
  theme: ThemeId | null;
  paletteIdx: number;
  media: string[];
  logo: string | null;
  cats: string[];
  products: DraftProduct[];
}

const EMPTY_PRODUCT: DraftProduct = { name: "", price: "", images: [] };
const INITIAL: WizardState = {
  step: 0,
  theme: null,
  paletteIdx: 0,
  media: [],
  logo: null,
  cats: [],
  products: [EMPTY_PRODUCT],
};

const stateKey = (shopId: string) => `frizmo-wizard-${shopId}`;

function loadState(shopId: string): WizardState {
  try {
    const raw = window.localStorage.getItem(stateKey(shopId));
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<WizardState>;
    return {
      ...INITIAL,
      ...parsed,
      theme: THEMES.includes(parsed.theme as ThemeId) ? (parsed.theme as ThemeId) : null,
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? (parsed.products as DraftProduct[])
          : [EMPTY_PRODUCT],
    };
  } catch {
    return INITIAL;
  }
}

/** Съотношение на снимка (за евристиката „най-хоризонталната → hero"). */
function imageRatio(path: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => resolve(1);
    img.src = publicImageUrl(path);
  });
}

/** Стъпките за индикатора (поздравът и финалът не се броят). */
const STEP_LABELS = ["Тема", "Цветове", "Снимки", "Продукти"];

/**
 * Onboarding wizard „до хубав сайт за 5 минути" — спец
 * docs/superpowers/specs/2026-07-06-website-onboarding-wizard.md.
 * Прилага курираната рецепта на темата (site-recipes.ts) върху данните и
 * медията на търговеца; резултатът се записва като ЧЕРНОВА.
 */
export function WebsiteWizard({
  shop,
  productCount,
  existingCategories,
}: {
  shop: WizardShop;
  /** Колко продукта има вече (гейтът гарантира ≥1) — стъпка 4 го отразява. */
  productCount: number;
  /** Имената на съществуващите категории — скриват се от предложенията. */
  existingCategories: string[];
}) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  /* Генерираните настройки — пазят се за „Публикувай" от финалния екран. */
  const [generated, setGenerated] = useState<unknown>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const done = generated !== null;

  /* Възстановяване на прогреса (localStorage) — след mount. */
  useEffect(() => {
    const saved = loadState(shop.id);
    queueMicrotask(() => {
      setState(saved);
      setHydrated(true);
    });
  }, [shop.id]);

  /* Закотвяне на URL-а: генерацията записва draft → server action-ите правят
     revalidatePath → страницата се пре-рендерира и (вече със site_settings ред)
     би сменила wizard-а с редактора ПРЕДИ финалния екран. С ?wizard=1 сървърът
     продължава да рендерира wizard-а; „Към редактора" чисти параметъра. */
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("wizard") !== "1") {
      router.replace("/dashboard/website?wizard=1", { scroll: false });
    }
  }, [router]);

  function update(patch: Partial<WizardState>) {
    const next = { ...state, ...patch };
    setState(next);
    try {
      window.localStorage.setItem(stateKey(shop.id), JSON.stringify(next));
    } catch {
      /* без персистиране — wizard-ът работи и така */
    }
  }

  const category = (shop.businessCategory || "Друго") as BusinessCategory;
  const recommended = recommendedThemesFor(category);
  /* Всичките 9 теми, препоръчаните за категорията първи (5+4 на десктоп). */
  const orderedThemes = [...recommended, ...THEMES.filter((t) => !recommended.includes(t))];

  const theme = state.theme ?? recommended[0]!;
  const palettes = THEME_PALETTES[theme];
  const palette: Palette = palettes[state.paletteIdx] ?? palettes[0]!;

  /** Финалната генерация: медия-разпределение → категории/продукти → draft. */
  async function generate() {
    setGenerating(true);
    try {
      /* 1. Медия: най-хоризонталната → hero; после снимка/текст и промо;
         останалите → галерия. */
      const ratios = await Promise.all(state.media.map((p) => imageRatio(p)));
      const byLandscape = state.media
        .map((path, i) => ({ path, ratio: ratios[i] ?? 1 }))
        .sort((a, b) => b.ratio - a.ratio);
      const [hero, imageText, promo, ...gallery] = byLandscape.map((m) => m.path);

      /* 2. Лого */
      if (state.logo && state.logo !== shop.logoPath) {
        await setShopLogo({ path: state.logo });
      }

      /* 3. Категории (пропуснатите грешки не спират сайта) */
      for (const name of state.cats) {
        const result = await createCategory({ name, parentId: "" });
        if (!result.ok) toast.error(`Категория „${name}": ${result.error}`);
      }

      /* 4. Продукти (само попълнените редове) */
      const filled = state.products.filter((p) => p.name.trim() && p.price.trim());
      for (const p of filled) {
        const result = await saveProduct(null, {
          name: p.name,
          price: p.price,
          images: p.images,
          description: "",
          categoryId: "",
        });
        if (!result.ok) toast.error(`Продукт „${p.name}": ${result.error}`);
      }

      /* 5. Сайтът — рецептата, записана като чернова. */
      const settings = siteSettingsSchema.parse({
        theme,
        primaryColor: palette.primary,
        accentColor: palette.accent,
        aboutText: shop.description,
        footerText: "",
        sections: buildRecipeSections({
          shopName: shop.name,
          description: shop.description,
          category,
          theme,
          media: { hero, imageText, promo, gallery },
        }),
      });
      const saved = await saveSiteSettings(settings);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }

      window.localStorage.removeItem(stateKey(shop.id));
      setGenerated(settings);
    } finally {
      setGenerating(false);
    }
  }

  /** „Публикувай": черновата → на живо (+ публикуване на магазина, ако е draft). */
  async function publish() {
    setPublishing(true);
    try {
      const result = await publishSiteSettings(generated);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (shop.status !== "published") {
        const shopResult = await publishShop();
        if (!shopResult.ok) {
          toast.error(shopResult.error);
          return;
        }
      }
      setPublished(true);
      toast.success("Магазинът ти е на живо!");
    } finally {
      setPublishing(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  /* ФИНАЛЕН ЕКРАН */
  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-5 text-center">
          <Image src="/bee-party.png" alt="" aria-hidden width={150} height={150} className="h-36 w-auto object-contain" />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
              {published ? "Магазинът ти е на живо!" : "Сайтът ти е готов!"}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-ink-600">
              {published
                ? "Клиентите вече могат да разглеждат и поръчват. Сподели линка!"
                : "Записахме го като чернова — само ти го виждаш. Разгледай го и го пусни на живо, когато си готов."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={`/s/${shop.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-control bg-ink-900 px-6 font-medium text-white transition-opacity hover:opacity-90"
            >
              Разгледай сайта си ↗
            </a>
            {!published && (
              <Button size="lg" onClick={publish} disabled={publishing}>
                {publishing ? "Публикуване…" : "Публикувай — на живо за всички"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                /* Чист URL (маха ?wizard=1 при рестарт) + свеж сървърен рендер. */
                router.push("/dashboard/website");
                router.refresh();
              }}
            >
              Към редактора
            </Button>
          </div>
          <p className="max-w-md text-xs text-ink-500">
            Искаш ние да го донастроим вместо теб? Пиши ни на{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </Shell>
    );
  }

  /* СТЪПКА 0 — Поздрав */
  if (state.step === 0) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 text-center">
          <Image src="/bee-wave.png" alt="" aria-hidden width={140} height={140} className="h-32 w-auto object-contain" />
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Да направим сайта на {shop.name}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-ink-600">
              Четири бързи стъпки — избираш как да изглежда, качваш няколко снимки
              и получаваш готов сайт. Отнема около 5 минути.
            </p>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-700">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                {label}
              </li>
            ))}
          </ul>
          <Button size="lg" onClick={() => update({ step: 1 })}>
            Старт
          </Button>
        </div>
      </Shell>
    );
  }

  /* СТЪПКА 1 — тема-карусел: фиксирана глава (назад | прогрес+заглавие |
     напред), 3 големи карти + peek на десктоп, 1 карта + swipe на телефон. */
  if (state.step === 1) {
    return (
      <Shell wide fill>
        <div className="flex h-full min-h-0 flex-col">
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="justify-self-start">
              <Button variant="ghost" onClick={() => update({ step: 0 })} className="max-lg:hidden">
                ← Назад
              </Button>
            </div>
            <StepIndicator current={1} compact />
            <div className="justify-self-end">
              <Button onClick={() => update({ step: 2, theme })} className="max-lg:hidden">
                Напред →
              </Button>
            </div>
          </div>
          <div className="mt-3 shrink-0 text-center">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Как да изглежда сайтът ти?
            </h1>
            <p className="mx-auto mt-1.5 max-w-lg text-sm text-ink-600">
              Първите са препоръчани за „{category}“ — избери с един клик, после
              можеш да смениш всичко.
            </p>
          </div>

          <ThemeCarousel
            themes={orderedThemes}
            activeTheme={theme}
            shopName={shop.name}
            onSelect={(t) => update({ theme: t, paletteIdx: 0 })}
          />

          {/* Мобилно: бутоните долу (ъглите са десктоп решение) */}
          <div className="mt-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
            <Button variant="ghost" onClick={() => update({ step: 0 })}>
              ← Назад
            </Button>
            <Button size="lg" onClick={() => update({ step: 2, theme })}>
              Напред →
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  /* СТЪПКИ 2–4 */
  return (
    <Shell>
      <StepIndicator current={state.step} />

      {state.step === 2 && (
        <StepBody
          title="Твоите цветове"
          hint="Подбрани да стоят добре на тази тема. Ако се колебаеш — първата е нашият избор."
          mascot="/bee-palette.png"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {palettes.map((p, i) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={i === state.paletteIdx}
                onClick={() => update({ paletteIdx: i })}
                className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
                  i === state.paletteIdx
                    ? "border-brand-600"
                    : "border-surface-200 hover:border-surface-300"
                }`}
              >
                <span className="flex -space-x-2">
                  <span className="size-9 rounded-full border-2 border-surface-0" style={{ background: p.primary }} />
                  <span className="size-9 rounded-full border-2 border-surface-0" style={{ background: p.accent }} />
                </span>
                <span className="text-sm font-medium text-ink-900">{p.name}</span>
              </button>
            ))}
          </div>
          <NavButtons
            onBack={() => update({ step: 1 })}
            onNext={() => update({ step: 3 })}
            skipLabel="Прескочи — първата е добра"
            onSkip={() => update({ step: 3, paletteIdx: 0 })}
          />
        </StepBody>
      )}

      {state.step === 3 && (
        <StepBody
          title="Покажи ни магазина си"
          hint="Качи 3–6 снимки (продукти, работилницата, теб). Ние ще ги подредим — най-добрата става начална."
          mascot="/bee-camera.png"
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Снимки за сайта</p>
              <ImageUploader
                images={state.media}
                onChange={(media) => update({ media })}
                max={6}
                kind="site"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-900">Лого (по желание)</p>
              <ImageUploader
                images={state.logo ? [state.logo] : []}
                onChange={(paths) => update({ logo: paths[0] ?? null })}
                max={1}
                kind="branding"
              />
            </div>
            <p className="flex items-start gap-2 text-xs text-ink-500">
              <Icon name="sparkles" size={14} className="mt-0.5 shrink-0" />
              Без снимки също става — сайтът изглежда добре и без тях, а можеш да
              добавиш по-късно.
            </p>
          </div>
          <NavButtons onBack={() => update({ step: 2 })} onNext={() => update({ step: 4 })} />
        </StepBody>
      )}

      {state.step === 4 && (
        <StepBody
          title="Категории и още продукти"
          hint={`Имаш ${productCount === 1 ? "1 продукт" : `${productCount} продукта`}${
            existingCategories.length > 0
              ? ` и ${existingCategories.length === 1 ? "1 категория" : `${existingCategories.length} категории`}`
              : ""
          } — сайтът ще ги покаже. Тук можеш да добавиш още, ако искаш.`}
          mascot="/bee-product.png"
        >
          <div className="flex flex-col gap-6">
            <div>
              {existingCategories.length > 0 && (
                <p className="mb-2 text-sm text-ink-600">
                  Вече имаш:{" "}
                  <span className="font-medium text-ink-900">{existingCategories.join(", ")}</span>
                </p>
              )}
              <p className="mb-2 text-sm font-medium text-ink-900">
                {existingCategories.length > 0
                  ? "Добави още категории (предложени за теб)"
                  : "Категории (предложени за теб)"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(CATEGORY_SUGGESTIONS[category] ?? CATEGORY_SUGGESTIONS["Друго"])
                  .filter((name) => !existingCategories.includes(name))
                  .map((name) => {
                  const active = state.cats.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        update({
                          cats: active
                            ? state.cats.filter((c) => c !== name)
                            : [...state.cats, name],
                        })
                      }
                      className={`flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-surface-300 text-ink-700 hover:border-brand-500"
                      }`}
                    >
                      {active && <Icon name="check" size={14} />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-ink-900">
                Още продукти — снимка + име + цена (по желание)
              </p>
              {state.products.map((product, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-card border border-surface-200 p-4 sm:flex-row sm:items-start"
                >
                  <ImageUploader
                    images={product.images}
                    onChange={(images) =>
                      update({
                        products: state.products.map((p, j) => (j === i ? { ...p, images } : p)),
                      })
                    }
                    max={1}
                    kind="product"
                  />
                  <div className="flex flex-1 flex-col gap-3">
                    <Input
                      label="Име на продукта"
                      hideLabel
                      placeholder="Име на продукта"
                      value={product.name}
                      onChange={(e) =>
                        update({
                          products: state.products.map((p, j) =>
                            j === i ? { ...p, name: e.target.value } : p,
                          ),
                        })
                      }
                    />
                    <Input
                      label="Цена (€)"
                      hideLabel
                      placeholder="Цена в евро, напр. 24.90"
                      inputMode="decimal"
                      value={product.price}
                      onChange={(e) =>
                        update({
                          products: state.products.map((p, j) =>
                            j === i ? { ...p, price: e.target.value } : p,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              {state.products.length < 3 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ products: [...state.products, EMPTY_PRODUCT] })}
                >
                  + Още един продукт
                </Button>
              )}
            </div>
          </div>
          <NavButtons
            onBack={() => update({ step: 3 })}
            onNext={generate}
            nextLabel={generating ? "Създаваме сайта…" : "Създай сайта ми"}
            nextDisabled={generating}
            skipLabel="Прескочи — ще добавя после"
            onSkip={generating ? undefined : generate}
          />
        </StepBody>
      )}
    </Shell>
  );
}

/* ---------- Обвивки ---------- */

function Shell({
  wide = false,
  fill = false,
  children,
}: {
  wide?: boolean;
  /** Стъпката управлява височината сама (каруселът) — без вертикално центриране. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    /* Билдър layout-ът е h-screen overflow-hidden (за редактора) — wizard-ът
       носи собствен вертикален скрол като защита за ниски екрани. */
    <div className="h-full overflow-y-auto">
      <div
        className={`mx-auto flex w-full flex-col px-4 ${
          wide ? "max-w-375 lg:px-8" : "max-w-3xl"
        } ${fill ? "h-full py-4 sm:py-5" : "min-h-full justify-center py-6 sm:py-8"}`}
      >
        {children}
      </div>
    </div>
  );
}

function StepIndicator({ current, compact = false }: { current: number; compact?: boolean }) {
  return (
    <ol
      className={`flex items-center justify-center gap-2 ${compact ? "" : "mb-5"}`}
      aria-label="Стъпки"
    >
      {STEP_LABELS.map((label, i) => {
        const stepNo = i + 1;
        const active = stepNo === current;
        const doneStep = stepNo < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold ${
                active
                  ? "bg-ink-900 text-white"
                  : doneStep
                    ? "bg-brand-100 text-brand-700"
                    : "bg-surface-100 text-ink-500"
              }`}
            >
              {doneStep ? <Icon name="check" size={12} /> : stepNo}
              <span className={active ? "" : "hidden sm:inline"}>{label}</span>
            </span>
            {i < STEP_LABELS.length - 1 && <span className="h-px w-3 bg-surface-300" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function StepBody({
  title,
  hint,
  mascot,
  children,
}: {
  title: string;
  hint: string;
  /** Маскот поза за стъпката (public path) — пчелата води процеса. */
  mascot?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 text-center">
        {mascot && (
          <Image
            src={mascot}
            alt=""
            aria-hidden
            width={96}
            height={96}
            className="mx-auto mb-2 h-16 w-auto object-contain"
          />
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-600">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Напред",
  nextDisabled = false,
  skipLabel,
  onSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
      <Button variant="ghost" onClick={onBack}>
        ← Назад
      </Button>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
        {skipLabel && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-ink-500 underline-offset-2 hover:underline"
          >
            {skipLabel}
          </button>
        )}
        <Button size="lg" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
