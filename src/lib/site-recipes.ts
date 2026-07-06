import { sectionSchema, type Section, type ThemeId } from "@/schemas/site-settings";
import type { BusinessCategory } from "@/schemas/shop";

/**
 * Рецептите на onboarding wizard-а: тема → композиция + категория → съдържание.
 * Принципът (спец 2026-07-06-website-onboarding-wizard.md): wizard-ът не пита
 * „кой вариант", а прилага курираната рецепта — изборът между варианти остава
 * в редактора. Прототипът на този модул е scripts/seed-demo-shops.mjs.
 */

/* ------------------------------------------------------------------ */
/* Палитри per тема — първата е палитрата на демото (дефолт).          */
/* ------------------------------------------------------------------ */

export interface Palette {
  name: string;
  primary: string;
  accent: string;
}

export const THEME_PALETTES: Record<ThemeId, Palette[]> = {
  classic: [
    { name: "Гора", primary: "#0e7c4a", accent: "#c98a1b" },
    { name: "Мастило", primary: "#1f2937", accent: "#b45309" },
    { name: "Океан", primary: "#1d4ed8", accent: "#0e9488" },
    { name: "Теракота", primary: "#b4532a", accent: "#3f6212" },
  ],
  atelie: [
    { name: "Канела", primary: "#a9642e", accent: "#c2410c" },
    { name: "Мед", primary: "#92400e", accent: "#b45309" },
    { name: "Маслина", primary: "#5f6b3c", accent: "#c2410c" },
    { name: "Глина", primary: "#9a5b45", accent: "#846358" },
  ],
  vitrina: [
    { name: "Въглен", primary: "#111111", accent: "#b4532a" },
    { name: "Нощ", primary: "#1e293b", accent: "#b45309" },
    { name: "Вино", primary: "#6d1f35", accent: "#1e293b" },
    { name: "Камел", primary: "#8a5a2b", accent: "#111111" },
  ],
  puls: [
    { name: "Киселина", primary: "#e8ff45", accent: "#ff4d6d" },
    { name: "Лед", primary: "#4df0ff", accent: "#ff4dd2" },
    { name: "Портокал", primary: "#ff7a1a", accent: "#4df0ff" },
    { name: "Виолет", primary: "#c4b5fd", accent: "#e8ff45" },
  ],
  efir: [
    { name: "Роза", primary: "#c98a9b", accent: "#7a9b8e" },
    { name: "Люляк", primary: "#a78bab", accent: "#6b8f82" },
    { name: "Праскова", primary: "#c99287", accent: "#7a8f9b" },
    { name: "Салвия", primary: "#8ba393", accent: "#c98a9b" },
  ],
  oniks: [
    { name: "Злато", primary: "#c9a25a", accent: "#c9a25a" },
    { name: "Шампанско", primary: "#d4bc8b", accent: "#d4bc8b" },
    { name: "Мед и роза", primary: "#c9a25a", accent: "#c987a0" },
    { name: "Платина", primary: "#c9cdd4", accent: "#c9a25a" },
  ],
  signal: [
    { name: "Петрол", primary: "#0e7490", accent: "#d97706" },
    { name: "Син сигнал", primary: "#1d4ed8", accent: "#0e9488" },
    { name: "Стомана", primary: "#33415c", accent: "#0e7490" },
    { name: "Смарагд", primary: "#047857", accent: "#b45309" },
  ],
  osnova: [
    { name: "Охра", primary: "#d98a1e", accent: "#3f6212" },
    { name: "Тухла", primary: "#b4532a", accent: "#1f2937" },
    { name: "Графит", primary: "#374151", accent: "#d98a1e" },
    { name: "Мъх", primary: "#4d7c0f", accent: "#92400e" },
  ],
  granit: [
    { name: "Кехлибар", primary: "#f0a63c", accent: "#5eead4" },
    { name: "Сигнално", primary: "#fb923c", accent: "#93c5fd" },
    { name: "Лайм", primary: "#a3e635", accent: "#f0a63c" },
    { name: "Лед", primary: "#7dd3fc", accent: "#fbbf24" },
  ],
};

/* ------------------------------------------------------------------ */
/* Предложени категории per бизнес категория (стъпка „Първи продукти") */
/* ------------------------------------------------------------------ */

export const CATEGORY_SUGGESTIONS: Record<BusinessCategory, string[]> = {
  "Дрехи и мода": ["Тениски", "Панталони", "Рокли", "Якета", "Аксесоари"],
  Обувки: ["Дамски", "Мъжки", "Спортни", "Официални", "Детски"],
  "Храни и напитки": ["Сладко", "Солено", "Напитки", "Подаръчни комплекти"],
  Козметика: ["Грижа за лице", "Грижа за тяло", "Коса", "Комплекти"],
  "Ръчна изработка": ["Керамика", "Бижута", "Декорация", "Текстил", "Свещи"],
  Електроника: ["Аудио", "Аксесоари", "Кабели и зарядни", "Смарт устройства"],
  "Строителни материали": ["Инструменти", "Крепежни елементи", "Бои и лакове", "Електро"],
  "За дома": ["Кухня", "Спалня", "Декорация", "Осветление", "Текстил"],
  Друго: ["Нови продукти", "Промоции", "Комплекти"],
};

/* ------------------------------------------------------------------ */
/* Съдържателни шаблони per категория (hero/promo/imageText/faq)       */
/* ------------------------------------------------------------------ */

interface CategoryContent {
  heroSubtitle: string;
  promo: { title: string; text: string };
  imageText: { title: string; text: string };
  faq: { question: string; answer: string }[];
}

const SHARED_FAQ = [
  {
    question: "Как се доставят поръчките?",
    answer:
      "Изпращаме с куриер до адрес или офис. Срокът обикновено е 1–3 работни дни след потвърждение на поръчката.",
  },
  {
    question: "Мога ли да върна продукт?",
    answer:
      "Да — имаш 14 дни да върнеш продукт в оригиналното му състояние. Свържи се с нас и ще уредим връщането бързо и лесно.",
  },
];

export const CATEGORY_CONTENT: Record<BusinessCategory, CategoryContent> = {
  "Дрехи и мода": {
    heroSubtitle: "Дрехи, които обличаш с удоволствие — подбрани с внимание към всеки детайл.",
    promo: {
      title: "Новата колекция е тук",
      text: "Разгледай последните попълнения — ограничени количества от всеки модел.",
    },
    imageText: {
      title: "Стил с характер",
      text: "Подбираме всяка дреха лично — материи, които се носят добре, и кройки, които стоят добре. Без компромиси с качеството.",
    },
    faq: [
      {
        question: "Как да избера правилния размер?",
        answer: "Към всеки продукт има таблица с размери. Ако се колебаеш между два — пиши ни, ще ти помогнем.",
      },
      ...SHARED_FAQ,
    ],
  },
  Обувки: {
    heroSubtitle: "Обувки за всеки ден и всеки повод — комфорт, който се усеща от първата крачка.",
    promo: {
      title: "Сезонни намаления",
      text: "Избрани модели с отстъпка — докато има наличности.",
    },
    imageText: {
      title: "Комфортът е на първо място",
      text: "Всеки чифт, който предлагаме, е избран заради качеството на изработката и удобството при носене. Краката ти ще усетят разликата.",
    },
    faq: [
      {
        question: "Какво да правя, ако номерът не ми стане?",
        answer: "Замяната е безплатна в рамките на 14 дни — просто ни пиши и ще изпратим друг номер.",
      },
      ...SHARED_FAQ,
    ],
  },
  "Храни и напитки": {
    heroSubtitle: "Вкусове, приготвени с грижа — от нашата кухня до твоята трапеза.",
    promo: {
      title: "Опитай новото",
      text: "Последните ни вкусове те чакат — поръчай, докато са пресни.",
    },
    imageText: {
      title: "Направено с любов",
      text: "Работим с подбрани съставки и малки партиди — така всяка хапка носи истински вкус. Без излишни консерванти, без компромиси.",
    },
    faq: [
      {
        question: "Колко трае срокът на годност?",
        answer: "Всеки продукт е с обозначен срок на етикета. Работим с малки партиди, за да получаваш винаги прясно.",
      },
      ...SHARED_FAQ,
    ],
  },
  Козметика: {
    heroSubtitle: "Грижа за кожата с чисти съставки — защото тя заслужава най-доброто.",
    promo: {
      title: "Ритуал за всеки ден",
      text: "Открий комплектите ни — грижа от глава до пети на специална цена.",
    },
    imageText: {
      title: "Чисти съставки, видим резултат",
      text: "Подбираме формули с натурални съставки, които работят. Всеки продукт е тестван с грижа и внимание към чувствителната кожа.",
    },
    faq: [
      {
        question: "Подходящи ли са продуктите за чувствителна кожа?",
        answer: "Повечето ни продукти са с меки формули. Виж описанието на всеки продукт или ни попитай — ще те насочим.",
      },
      ...SHARED_FAQ,
    ],
  },
  "Ръчна изработка": {
    heroSubtitle: "Изработено на ръка, с внимание към всеки детайл — всяко парче е единствено.",
    promo: {
      title: "Единствени бройки",
      text: "Ръчната изработка значи ограничени количества — ако нещо ти хареса, не чакай.",
    },
    imageText: {
      title: "Историята зад всяко парче",
      text: "Всяко изделие минава през ръцете ни от идеята до опаковката. Малки несъвършенства правят всяко парче единствено — това е чарът на ръчния труд.",
    },
    faq: [
      {
        question: "Мога ли да поръчам нещо по индивидуален проект?",
        answer: "Да! Пиши ни какво си представяш и ще обсъдим изработката, срока и цената.",
      },
      ...SHARED_FAQ,
    ],
  },
  Електроника: {
    heroSubtitle: "Техника, на която можеш да разчиташ — проверена, гарантирана, на добра цена.",
    promo: {
      title: "Топ оферти на седмицата",
      text: "Избрани устройства на специални цени — количествата са ограничени.",
    },
    imageText: {
      title: "Качество с гаранция",
      text: "Всеки продукт идва с гаранция и реална поддръжка. Ако имаш въпрос преди или след покупката — насреща сме.",
    },
    faq: [
      {
        question: "Има ли гаранция?",
        answer: "Да — всички продукти са с гаранция. Срокът е посочен в описанието на всеки продукт.",
      },
      ...SHARED_FAQ,
    ],
  },
  "Строителни материали": {
    heroSubtitle: "Всичко за обекта на едно място — качествени материали на честни цени.",
    promo: {
      title: "Оферта за майстори",
      text: "Специални цени при по-големи количества — питай ни за оферта.",
    },
    imageText: {
      title: "Партньор на всеки обект",
      text: "Работим и с майстори, и с домашни ентусиасти. Ще те посъветваме кой материал върши работа — без да плащаш за повече, отколкото ти трябва.",
    },
    faq: [
      {
        question: "Правите ли доставка до обект?",
        answer: "Да — доставяме до адрес или директно до обекта. За по-големи количества се уговаряме индивидуално.",
      },
      ...SHARED_FAQ,
    ],
  },
  "За дома": {
    heroSubtitle: "Неща за дома, които правят всекидневието по-приятно — практични и красиви.",
    promo: {
      title: "Освежи дома си",
      text: "Подбрани предмети за уютен дом — на цени, които ще те зарадват.",
    },
    imageText: {
      title: "Дом с настроение",
      text: "Вярваме, че хубавите неща за дома не трябва да са скъпи. Подбираме практични и красиви предмети, които се използват всеки ден.",
    },
    faq: [
      {
        question: "Как се опаковат чупливите продукти?",
        answer: "Всяка чуплива пратка се опакова допълнително. Ако нещо пристигне повредено — заменяме го веднага.",
      },
      ...SHARED_FAQ,
    ],
  },
  Друго: {
    heroSubtitle: "Добре дошъл в нашия онлайн магазин — разгледай и открий нещо за теб.",
    promo: {
      title: "Специална оферта",
      text: "Разгледай избраните ни предложения — на специални цени за ограничено време.",
    },
    imageText: {
      title: "Защо да пазаруваш от нас",
      text: "Зад този магазин стоят реални хора, които държат на всяка поръчка. Подбираме внимателно какво предлагаме и отговаряме бързо на всеки въпрос.",
    },
    faq: [...SHARED_FAQ],
  },
};

/* ------------------------------------------------------------------ */
/* Рецептата: тема + категория + медия → пълен списък секции           */
/* ------------------------------------------------------------------ */

/** Hero композиция per тема (както демотата; останалите = split). */
const THEME_HERO_LAYOUT: Partial<Record<ThemeId, "split" | "poster" | "statement">> = {
  granit: "statement",
};

export interface RecipeInput {
  shopName: string;
  /** Описанието на магазина (от профила) — първото изречение влиза в hero-то. */
  description: string;
  category: BusinessCategory;
  theme: ThemeId;
  media: {
    hero?: string;
    imageText?: string;
    promo?: string;
    gallery: string[];
  };
}

const section = (type: string, data: Record<string, unknown>): Section =>
  sectionSchema.parse({ id: crypto.randomUUID(), type, enabled: true, data });

/**
 * Строи секциите на сайта по рецептата. Редът и подборът следват демотата
 * (прототип: seed buildAllSections), с две разлики за реален търговец:
 * НЕ генерираме отзиви (фалшиви отзиви = доверие-провал; секцията се добавя
 * празна и скрита — търговецът я пълни с истински) и промо банерът влиза
 * само ако има категорийно съдържание.
 */
export function buildRecipeSections(input: RecipeInput): Section[] {
  const content = CATEGORY_CONTENT[input.category] ?? CATEGORY_CONTENT["Друго"];
  const firstSentence = input.description.split(".")[0]?.trim();
  const heroSubtitle = firstSentence ? `${firstSentence}.` : content.heroSubtitle;

  const sections: Section[] = [
    section("hero", {
      layout: THEME_HERO_LAYOUT[input.theme] ?? "split",
      title: input.shopName,
      subtitle: heroSubtitle,
      ctaLabel: "Разгледай продуктите",
      ctaHref: "",
      imagePaths: input.media.hero ? [input.media.hero] : [],
    }),
    section("trust-badges", {
      items: [
        { icon: "truck", text: "Бърза доставка" },
        { icon: "return", text: "Връщане до 14 дни" },
        { icon: "shield", text: "Сигурно плащане" },
        { icon: "star", text: "Проверено качество" },
      ],
    }),
    section("featured-products", { title: "Най-нови продукти", mode: "newest", productIds: [] }),
    section("category-grid", { title: "Разгледай по категория", categoryIds: [] }),
    section("promo-banner", {
      title: content.promo.title,
      text: content.promo.text,
      ctaLabel: "Виж повече",
      ctaHref: "",
      imagePath: input.media.promo ?? "",
    }),
    section("image-text", {
      title: content.imageText.title,
      text: content.imageText.text,
      imagePath: input.media.imageText ?? "",
      imageSide: "left",
    }),
  ];

  if (input.media.gallery.length > 0) {
    sections.push(section("gallery", { title: "Галерия", imagePaths: input.media.gallery }));
  }

  sections.push(
    /* Празна и изключена: търговецът я включва, когато има ИСТИНСКИ отзиви. */
    { ...section("testimonials", { title: "Какво казват клиентите", items: [] }), enabled: false },
    section("faq", { title: "Често задавани въпроси", items: content.faq }),
    section("contact-map", { title: "Къде да ни намериш", showMap: true }),
    section("socials", { title: "Последвай ни" }),
  );

  return sections;
}
