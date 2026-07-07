import type { CSSProperties } from "react";
import { accentInk, onColor } from "@/lib/contrast";
import { fontPairVars } from "@/lib/font-pairs";
import type { BusinessCategory } from "@/schemas/shop";
import type { SiteSettings, ThemeId } from "@/schemas/site-settings";

/**
 * Темите на публичните магазини. Това Е дефиницията на темите (техният
 * "tokens.css") — единственото място със стойности за --sf-* променливите.
 * Storefront компонентите ползват само променливите; заглавията получават
 * шрифт/тежест от глобалното правило [data-storefront] в globals.css.
 */
export interface ThemeVars {
  "--sf-bg": string;
  "--sf-surface": string;
  /** „Повдигната" повърхност за карти върху surface фон (стъпка над surface). */
  "--sf-surface-raised": string;
  "--sf-text": string;
  "--sf-muted": string;
  "--sf-border": string;
  /** Сянка на картите: светлите теми — мека сянка; тъмните — 1px бордер (сянка не се вижда). */
  "--sf-shadow": string;
  /** Градиент върху hero/категорийни снимки — гарантира четим текст върху произволна снимка. */
  "--sf-overlay": string;
  "--sf-radius": string;
  "--sf-heading-weight": string;
  "--sf-font-heading": string;
  "--sf-font-body": string;
  /** Навигация в header-а: uppercase (лукс/индустриални теми) или none. */
  "--sf-nav-case": string;
  /** Letterspacing на навигацията — върви ръка за ръка с nav-case. */
  "--sf-nav-tracking": string;
  /** Пълен border-radius на split-hero снимката: „арков прозорец" (едри горни
   *  радиуси) при занаятчийските теми, малък/0 при острите. */
  "--sf-hero-radius": string;
  /** Рамка на split-hero снимката (box-shadow): офсетен акцентен блок / тънък кант / none. */
  "--sf-hero-frame": string;
  /** Стил на акцентната дума в hero заглавието: italic при серифните теми. */
  "--sf-title-accent-style": string;
  /** Кадър-ринг: 1px вътрешен ръб на снимките (свет. теми тъмен, тъмни — светъл)
   *  — „затваря" кадъра при снимка в тона на фона. Универсална корекция. */
  "--sf-photo-ring": string;
  /** Едва доловим вертикален градиент на surface лентите (само меките теми). */
  "--sf-surface-wash": string;
  /** Radial „мъгла" от primary зад hero текста (само топлите/меките теми). */
  "--sf-hero-mist": string;
  /** Материален CTA: микро-градиент върху primary (само където бутонът е
   *  голяма плоска повърхност). none = плосък бутон (нарочно при Пулс и др.). */
  "--sf-cta-gloss": string;
  /** Вътрешен светъл ръб на материалния CTA (върви с gloss). */
  "--sf-cta-edge": string;
  /** По-дълбока сянка при hover на карти (тъмните теми: без промяна — ринг). */
  "--sf-shadow-hover": string;
  /** Цвят на ъгловите скоба-маркери върху снимките (⌐ визьор) — подписът на
   *  Сигнал; transparent = без скоби (всички останали). Рисува се в
   *  .sf-frame::after (globals.css). */
  "--sf-photo-corners": string;
  /** Opacity на хартиеното зърно върху surface лентите — подписът на Ателие
   *  („хартия, не екран" буквално); 0 = без зърно. */
  "--sf-surface-grain": string;
}

/* Общи стойности за ефект-токените. */
const WASH =
  "linear-gradient(to bottom, color-mix(in oklab, var(--sf-surface), var(--sf-bg) 60%), var(--sf-surface) 55%)";
const MIST =
  "radial-gradient(42rem 30rem at 20% 45%, color-mix(in oklab, var(--sf-primary) 7%, transparent), transparent 70%)";
const CTA_GLOSS =
  "linear-gradient(to bottom, color-mix(in oklab, var(--sf-primary), #ffffff 7%), color-mix(in oklab, var(--sf-primary), #000000 8%))";
const CTA_EDGE = "inset 0 1px 0 0 color-mix(in oklab, var(--sf-primary), #ffffff 25%)";

/* Overlay градиенти — две плътности (тъмните теми искат по-плътно затъмняване). */
const OVERLAY_LIGHT =
  "linear-gradient(to top, rgba(0,0,0,.62) 0%, rgba(0,0,0,.28) 45%, rgba(0,0,0,.08) 100%)";
const OVERLAY_DARK =
  "linear-gradient(to top, rgba(0,0,0,.74) 0%, rgba(0,0,0,.4) 45%, rgba(0,0,0,.14) 100%)";

export const THEME_PRESETS: Record<ThemeId, ThemeVars> = {
  /* Изчистена, безвремева — за всеки бизнес. Heading = Onest (неутрален, но
     с лице — Inter като display беше generic под прага; одит 2026-07-05). */
  classic: {
    "--sf-bg": "#ffffff",
    "--sf-surface": "#f2f2ef",
    "--sf-surface-raised": "#ffffff",
    "--sf-text": "#1d1d1b",
    "--sf-muted": "#6d6d68",
    "--sf-border": "#e2e2dd",
    "--sf-shadow": "0 1px 3px rgba(29,29,27,.08), 0 10px 30px rgba(29,29,27,.10)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.375rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-onest), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "none",
    "--sf-nav-tracking": "0.01em",
    "--sf-hero-radius": "0.375rem",
    "--sf-hero-frame": "none",
    "--sf-title-accent-style": "normal",
    /* Карта на ефектите (одит 2026-07-05): Класик = C+D+E — неутралността е
       характерът, без атмосферни ефекти; само „невидимото качество". */
    "--sf-photo-ring": "rgba(0,0,0,.06)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": CTA_GLOSS,
    "--sf-cta-edge": CTA_EDGE,
    "--sf-shadow-hover": "0 2px 6px rgba(29,29,27,.10), 0 16px 40px rgba(29,29,27,.14)",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
  /* Ателие — топла светла, сериф: занаяти, храни артизан, за дома */
  atelie: {
    "--sf-bg": "#faf5ec",
    "--sf-surface": "#f3ecdd",
    "--sf-surface-raised": "#fffdf8",
    "--sf-text": "#33271a",
    "--sf-muted": "#6f5f4a",
    "--sf-border": "#e9ddc9",
    "--sf-shadow": "0 1px 3px rgba(51,39,26,.10), 0 12px 32px rgba(51,39,26,.12)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.625rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "none",
    "--sf-nav-tracking": "0.01em",
    "--sf-hero-radius": "18rem 18rem 0.625rem 0.625rem",
    "--sf-hero-frame": "none",
    "--sf-title-accent-style": "italic",
    /* Ателие = A+B+D+E: „хартия, не екран" — светлина върху лен + теракотена
       мъгла. Без C: артизанският бутон е нарочно матов. */
    "--sf-photo-ring": "rgba(51,39,26,.08)",
    "--sf-surface-wash": WASH,
    "--sf-hero-mist": MIST,
    "--sf-cta-gloss": "none",
    "--sf-cta-edge": "none",
    "--sf-shadow-hover": "0 2px 6px rgba(51,39,26,.12), 0 18px 44px rgba(51,39,26,.16)",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0.05",
  },
  /* Витрина — изчистена светла, image-first: мода премиум, обувки */
  vitrina: {
    "--sf-bg": "#ffffff",
    "--sf-surface": "#f5f5f5",
    "--sf-surface-raised": "#ffffff",
    "--sf-text": "#111111",
    "--sf-muted": "#5b5b5b",
    "--sf-border": "#ececec",
    "--sf-shadow": "0 1px 2px rgba(17,17,17,.05), 0 4px 14px rgba(17,17,17,.05)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.125rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "uppercase",
    "--sf-nav-tracking": "0.14em",
    "--sf-hero-radius": "0",
    "--sf-hero-frame": "none",
    "--sf-title-accent-style": "normal",
    /* Витрина = само D: галерийната плоскост Е подписът. */
    "--sf-photo-ring": "rgba(0,0,0,.06)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": "none",
    "--sf-cta-edge": "none",
    "--sf-shadow-hover": "0 1px 2px rgba(17,17,17,.05), 0 4px 14px rgba(17,17,17,.05)",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
  /* Пулс — ТЪМНА смела: streetwear, младежки брандове, аксесоари */
  puls: {
    "--sf-bg": "#111111",
    "--sf-surface": "#1a1a1a",
    "--sf-surface-raised": "#232323",
    "--sf-text": "#fafafa",
    "--sf-muted": "#a3a3a3",
    "--sf-border": "#2e2e2e",
    "--sf-shadow": "0 0 0 1px #2e2e2e",
    "--sf-overlay": OVERLAY_DARK,
    "--sf-radius": "0.25rem",
    "--sf-heading-weight": "800",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "uppercase",
    "--sf-nav-tracking": "0.12em",
    "--sf-hero-radius": "0",
    "--sf-hero-frame": "-0.875rem 0.875rem 0 0 var(--sf-accent)",
    "--sf-title-accent-style": "normal",
    /* Пулс = само D (светъл ринг): неонът е нарочно плосък. */
    "--sf-photo-ring": "rgba(255,255,255,.08)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": "none",
    "--sf-cta-edge": "none",
    "--sf-shadow-hover": "0 0 0 1px #2e2e2e",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
  /* Ефир — светла wellness: козметика clean, натурална грижа, био.
     Контрастът вдигнат (одит 2026-07-05): розова мъгла в 3% диапазон +
     тежест 600 четеше „изпрано". */
  efir: {
    "--sf-bg": "#fdf1ef",
    "--sf-surface": "#f7e0dc",
    "--sf-surface-raised": "#fffafb",
    "--sf-text": "#4e323d",
    "--sf-muted": "#7d5c68",
    "--sf-border": "#ecd2d8",
    "--sf-shadow": "0 1px 3px rgba(90,61,71,.10), 0 12px 32px rgba(90,61,71,.12)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.75rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-lora), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "none",
    "--sf-nav-tracking": "0.02em",
    /* Подписът на Ефир: мека органична „капка" (blob) вместо арката — арката
       остава само на Ателие (одит 2026-07-06: двете я споделяха). */
    "--sf-hero-radius": "54% 46% 44% 56% / 48% 56% 44% 52%",
    "--sf-hero-frame": "none",
    "--sf-title-accent-style": "italic",
    /* Ефир = A+B+C+D+E (пълния сет): най-бледата тема — wellness дълбочина. */
    "--sf-photo-ring": "rgba(90,61,71,.08)",
    "--sf-surface-wash": WASH,
    "--sf-hero-mist": MIST,
    "--sf-cta-gloss": CTA_GLOSS,
    "--sf-cta-edge": CTA_EDGE,
    "--sf-shadow-hover": "0 2px 6px rgba(90,61,71,.12), 0 18px 44px rgba(90,61,71,.16)",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0.03",
  },
  /* Оникс — ТЪМНА premium, display сериф: луксозна козметика, бижута */
  oniks: {
    "--sf-bg": "#14100c",
    "--sf-surface": "#1c1610",
    "--sf-surface-raised": "#241d14",
    "--sf-text": "#f3ead9",
    "--sf-muted": "#9a8b72",
    "--sf-border": "#2e2519",
    "--sf-shadow": "0 0 0 1px #2e2519",
    "--sf-overlay": OVERLAY_DARK,
    "--sf-radius": "0.25rem",
    "--sf-heading-weight": "600",
    "--sf-font-heading": "var(--font-playfair), Georgia, serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "uppercase",
    "--sf-nav-tracking": "0.18em",
    "--sf-hero-radius": "0.25rem",
    /* Подписът на Оникс: двоен златен кант — 1px до кадъра + втора златна
       hairline на 10px отстъп (бижутерска рамка; 1px сам беше невидим). */
    "--sf-hero-frame":
      "0 0 0 1px var(--sf-accent), 0 0 0 10px var(--sf-bg), 0 0 0 11px var(--sf-accent)",
    "--sf-title-accent-style": "italic",
    /* Оникс = C+D: златото никога не е плоско (материален CTA); светъл ринг
       пази тъмните кадри. Нищо друго — темата е добра. */
    "--sf-photo-ring": "rgba(243,234,217,.10)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": CTA_GLOSS,
    "--sf-cta-edge": CTA_EDGE,
    "--sf-shadow-hover": "0 0 0 1px #2e2519",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
  /* Сигнал — студена структурирана, trust-focused: електроника, техника.
     Контраст + подпис (одит 2026-07-05): сиво-на-сиво без детайл = анонимна. */
  signal: {
    "--sf-bg": "#f4f6f8",
    "--sf-surface": "#e3eaf0",
    "--sf-surface-raised": "#ffffff",
    "--sf-text": "#0f1b2a",
    "--sf-muted": "#5a6b7a",
    "--sf-border": "#cdd8e1",
    "--sf-shadow": "0 1px 3px rgba(15,27,42,.09), 0 10px 30px rgba(15,27,42,.10)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.375rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-space-grotesk), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "none",
    "--sf-nav-tracking": "0.02em",
    "--sf-hero-radius": "0.375rem",
    /* Подписът на Сигнал: „техническа плоча" — двоен кант с въздух (рамкиран
       уред), в primary цвета на магазина. */
    "--sf-hero-frame": "0 0 0 6px var(--sf-bg), 0 0 0 8px var(--sf-primary)",
    "--sf-title-accent-style": "normal",
    /* Сигнал = A+C+D+E: „техническо стъкло" градиент + материален бутон-уред.
       Без B: мъглата е мека, Сигнал е структурен. */
    "--sf-photo-ring": "rgba(15,27,42,.07)",
    "--sf-surface-wash": WASH,
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": CTA_GLOSS,
    "--sf-cta-edge": CTA_EDGE,
    "--sf-shadow-hover": "0 2px 6px rgba(15,27,42,.11), 0 16px 40px rgba(15,27,42,.14)",
    "--sf-photo-corners": "color-mix(in oklab, var(--sf-primary) 85%, transparent)",
    "--sf-surface-grain": "0",
  },
  /* Основа — светла индустриална, кондензиран: строителни, за дома */
  osnova: {
    "--sf-bg": "#f5f2ee",
    "--sf-surface": "#ebe6df",
    "--sf-surface-raised": "#ffffff",
    "--sf-text": "#211d18",
    "--sf-muted": "#6e665c",
    "--sf-border": "#e2ddd5",
    "--sf-shadow": "0 1px 3px rgba(33,29,24,.08), 0 6px 20px rgba(33,29,24,.06)",
    "--sf-overlay": OVERLAY_LIGHT,
    "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "uppercase",
    "--sf-nav-tracking": "0.1em",
    "--sf-hero-radius": "0",
    /* Подписът на Основа: плътна „носеща греда" в primary точно под кадъра —
       снимката стои върху основа (индустриално, буквално името на темата). */
    "--sf-hero-frame": "0 0.875rem 0 0 var(--sf-primary)",
    "--sf-title-accent-style": "normal",
    /* Основа = D+E: индустриална твърдост — без мъгли/градиенти. */
    "--sf-photo-ring": "rgba(33,29,24,.07)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": "none",
    "--sf-cta-edge": "none",
    "--sf-shadow-hover": "0 2px 6px rgba(33,29,24,.11), 0 16px 40px rgba(33,29,24,.14)",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
  /* Гранит — ТЪМНА индустриална, кондензиран: строителни, инструменти */
  granit: {
    "--sf-bg": "#1c1e21",
    "--sf-surface": "#25282c",
    "--sf-surface-raised": "#2f3338",
    "--sf-text": "#eef0f2",
    "--sf-muted": "#a2a8af",
    "--sf-border": "#3a3e43",
    "--sf-shadow": "0 0 0 1px #3a3e43",
    "--sf-overlay": OVERLAY_DARK,
    "--sf-radius": "0.1875rem",
    "--sf-heading-weight": "700",
    "--sf-font-heading": "var(--font-condensed), ui-sans-serif, sans-serif",
    "--sf-font-body": "var(--font-inter), ui-sans-serif, sans-serif",
    "--sf-nav-case": "uppercase",
    "--sf-nav-tracking": "0.1em",
    "--sf-hero-radius": "0",
    /* Подписът на Гранит: офсетна „стоманена плоча" (surface-raised тон) +
       тънък кант — индустриалният брат на офсетния блок на Пулс. */
    "--sf-hero-frame": "0 0 0 1px #3a3e43, 0.875rem 0.875rem 0 0 #2f3338",
    "--sf-title-accent-style": "normal",
    /* Гранит = само D (светъл ринг): стоманата си има подписа. */
    "--sf-photo-ring": "rgba(255,255,255,.08)",
    "--sf-surface-wash": "none",
    "--sf-hero-mist": "none",
    "--sf-cta-gloss": "none",
    "--sf-cta-edge": "none",
    "--sf-shadow-hover": "0 0 0 1px #3a3e43",
    "--sf-photo-corners": "transparent",
    "--sf-surface-grain": "0",
  },
};

export const THEME_LABELS: Record<ThemeId, string> = {
  classic: "Класическа",
  atelie: "Ателие",
  vitrina: "Витрина",
  puls: "Пулс",
  efir: "Ефир",
  oniks: "Оникс",
  signal: "Сигнал",
  osnova: "Основа",
  granit: "Гранит",
};

export interface ThemeMeta {
  /** Кратко усещане — за preview картата в setup wizard-а. */
  tagline: string;
  /** За кои магазини е подходяща. */
  bestFor: string;
  /** Тъмна тема (тъмен фон/светъл текст) — за групиране в UI. */
  isDark: boolean;
}

/** Метаданни на всяка тема — захранва preview картите в setup wizard-а. */
export const THEME_META: Record<ThemeId, ThemeMeta> = {
  classic: { tagline: "Изчистена и безвремева — за всеки бизнес.", bestFor: "Универсална", isDark: false },
  atelie: { tagline: "Топла и автентична — усеща се ръчният труд.", bestFor: "Ръчна изработка, храни, за дома", isDark: false },
  vitrina: { tagline: "Минимал, който оставя снимките да говорят.", bestFor: "Мода, обувки", isDark: false },
  puls: { tagline: "Смела и енергична — за младежки брандове.", bestFor: "Streetwear, аксесоари", isDark: true },
  efir: { tagline: "Нежна и чиста — wellness усещане.", bestFor: "Козметика, натурална грижа", isDark: false },
  oniks: { tagline: "Тъмен лукс със златен акцент.", bestFor: "Луксозна козметика, бижута", isDark: true },
  signal: { tagline: "Ясна и надеждна — фокус върху доверие.", bestFor: "Електроника, техника", isDark: false },
  osnova: { tagline: "Здрава и практична — за материали и инструменти.", bestFor: "Строителни, за дома", isDark: false },
  granit: { tagline: "Тъмна индустриална — професионално усещане.", bestFor: "Строителни, инструменти", isDark: true },
};

/**
 * Категория на бизнеса → 2–3 препоръчани теми (за setup wizard-а).
 * Изведено от проучването на реални магазини по вертикал
 * (docs/research/2026-07-05-ecommerce-design-research.md).
 */
export const CATEGORY_THEME_RECOMMENDATIONS: Record<BusinessCategory, ThemeId[]> = {
  "Дрехи и мода": ["vitrina", "puls", "oniks"],
  Обувки: ["vitrina", "puls"],
  "Храни и напитки": ["atelie", "efir"],
  Козметика: ["efir", "oniks"],
  "Ръчна изработка": ["atelie", "vitrina"],
  Електроника: ["signal", "vitrina"],
  "Строителни материали": ["osnova", "granit"],
  "За дома": ["atelie", "osnova", "vitrina"],
  Друго: ["classic", "vitrina"],
};

/** Препоръчани теми за категория; fallback за непозната стойност. */
export function recommendedThemesFor(category: string): ThemeId[] {
  return (
    (CATEGORY_THEME_RECOMMENDATIONS as Record<string, ThemeId[]>)[category] ?? [
      "classic",
      "vitrina",
    ]
  );
}

export function themeStyle(
  settings: Pick<SiteSettings, "theme" | "primaryColor" | "accentColor"> &
    Partial<Pick<SiteSettings, "fontPair">>,
): CSSProperties {
  const preset = THEME_PRESETS[settings.theme];
  /* Избраната шрифт-двойка override-ва шрифтовете на темата; "theme"/undefined
     → null → остават стойностите от preset-а. */
  const fonts = settings.fontPair ? fontPairVars(settings.fontPair) : null;
  return {
    ...preset,
    ...(fonts && {
      "--sf-font-heading": fonts.heading,
      "--sf-font-body": fonts.body,
    }),
    "--sf-primary": settings.primaryColor,
    "--sf-accent": settings.accentColor,
    /* Изчислени, не гадани: текстът върху primary/accent остава четим при
       произволен избран цвят (неоново жълто → тъмен текст, тъмно синьо → бял). */
    "--sf-on-primary": onColor(settings.primaryColor),
    "--sf-on-accent": onColor(settings.accentColor),
    /* Акцентната дума в hero заглавието: акцентът само ако е четим (3:1 за
       едър текст) върху фона на темата / върху тъмен overlay — иначе fallback. */
    "--sf-accent-ink": accentInk(settings.accentColor, preset["--sf-bg"], preset["--sf-text"]),
    "--sf-accent-ink-dark": accentInk(settings.accentColor, "#1c1c1c", "#ffffff"),
  } as CSSProperties;
}
