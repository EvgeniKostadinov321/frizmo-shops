"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui";
import type { Category, Shop } from "@/db";
import { publicImageUrl } from "@/lib/storage";
import type { SiteSettings } from "@/schemas/site-settings";
import { themeStyle } from "@/lib/themes";
import { CartButton } from "../cart-button";

export interface HeaderVariantProps {
  shop: Shop;
  settings: SiteSettings;
  /** Основни категории — при 1–4 влизат директно в навигацията. */
  rootCategories?: Category[];
  /**
   * Началната страница започва с пълноекранен hero със снимка → header-ът
   * ляга ВЪРХУ него: прозрачен на върха, „втвърдява" се при скрол.
   */
  heroOverlay?: boolean;
  /** S3: логнат ли е посетителят (купувач) — сменя профил иконата към акаунт/вход. */
  viewerLoggedIn?: boolean;
  /** S3-глобален: любим ли е този магазин за текущия купувач. */
  shopFavorited?: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  /** Външен линк (target=_blank). Вътрешните пътища минават през next/link. */
  external?: boolean;
}

/** Ръчните линкове от настройките (settings.navLinks). */
export interface ManualNavLink {
  id: string;
  label: string;
  href: string;
}

/** Външен ли е href-ът (пълен URL / протокол) — иначе вътрешен път. */
function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

/**
 * Общата навигация: авто база (категориите заместват „Продукти", когато са
 * малко) + ръчните линкове на търговеца, ДОБАВЕНИ накрая (settings.navLinks).
 * Ръчните с празен етикет/href се изпускат.
 */
export function buildNav(
  base: string,
  rootCategories: Category[],
  navLinks: ManualNavLink[] = [],
): NavItem[] {
  const categoryNav =
    rootCategories.length >= 1 && rootCategories.length <= 4
      ? rootCategories.map((c) => ({
          href: `${base}/products?category=${c.id}`,
          label: c.name,
        }))
      : [{ href: `${base}/products`, label: "Продукти" }];
  const manual: NavItem[] = navLinks
    .filter((l) => l.label.trim() && l.href.trim())
    .map((l) => ({ label: l.label, href: l.href, external: isExternal(l.href) }));
  return [
    ...categoryNav,
    { href: `${base}/about`, label: "За нас" },
    { href: `${base}/contact`, label: "Контакти" },
    ...manual,
  ];
}

/** Лого + име: wordmark-ът говори с гласа на темата (--sf-font-heading). */
export function Brand({
  shop,
  base,
  size = "md",
  logoOnly = false,
}: {
  shop: Shop;
  base: string;
  size?: "md" | "lg";
  /** Само логото, без името (settings.logoOnly) — изисква качено лого. */
  logoOnly?: boolean;
}) {
  const logoPx = size === "lg" ? 52 : 40;
  const boxClass = size === "lg" ? "size-13" : "size-10";
  const textClass = size === "lg" ? "text-2xl" : "text-xl";
  /* Без лого няма какво да остане → името винаги се показва. */
  const hideName = logoOnly && Boolean(shop.logoPath);
  return (
    <Link href={base} className="flex min-w-0 items-center gap-3">
      {shop.logoPath ? (
        <Image
          src={publicImageUrl(shop.logoPath)}
          alt={`Лого на ${shop.name}`}
          width={logoPx}
          height={logoPx}
          className={`${boxClass} shrink-0 rounded-(--sf-radius) object-cover`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex ${boxClass} shrink-0 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) font-bold text-(--sf-on-primary) ${
            size === "lg" ? "text-xl" : "text-lg"
          }`}
        >
          {shop.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {!hideName && (
        <span
          className={`truncate tracking-tight [font-family:var(--sf-font-heading)] font-(--sf-heading-weight) ${textClass}`}
        >
          {shop.name}
        </span>
      )}
    </Link>
  );
}

/** Десктоп навигационен линк с активно състояние + underline анимация.
 *  Външните линкове минават през <a target=_blank>. */
export function NavLink({ item, current }: { item: NavItem; current: boolean }) {
  const className =
    "sf-nav-link flex h-11 shrink-0 items-center px-3 text-sm font-medium text-current";
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} aria-current={current ? "page" : undefined} className={className}>
      {item.label}
    </Link>
  );
}

/** Праг за инлайн линкове преди „Още" dropdown-а (десктоп варианти 1 и 2). */
export const NAV_INLINE_MAX = 5;

/** Разделя навигацията на инлайн (първите NAV_INLINE_MAX) + overflow (остатъка). */
export function splitNav(nav: NavItem[]): { inline: NavItem[]; overflow: NavItem[] } {
  if (nav.length <= NAV_INLINE_MAX) return { inline: nav, overflow: [] };
  return { inline: nav.slice(0, NAV_INLINE_MAX), overflow: nav.slice(NAV_INLINE_MAX) };
}

/** Активна страница: само за линкове без query (категориите споделят път). */
export function useIsCurrent() {
  const pathname = usePathname();
  return (href: string) => !href.includes("?") && pathname === href;
}

/**
 * Sticky състояние на header-а: прозрачен върху hero снимката на началната
 * страница, „втвърдява" се при скрол. Връща дали да е прозрачен + дали overlay
 * режимът е активен (за отрицателния margin, който вдига hero-то под header-а).
 */
export function useHeaderState(base: string, heroOverlay: boolean, centered: boolean) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const overlayPage = heroOverlay && !centered && pathname === base;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    /* Синхронен setState в effect чупи react-compiler lint → microtask. */
    queueMicrotask(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { overlayPage, scrolled };
}

/**
 * Страничен drawer — тесен панел, влизащ отдясно, със scrim отзад. Рендерира
 * се през ПОРТАЛ в собствен контейнер, закачен за <body> (React reconciler-ът
 * не пипа самото <body>, където живее anti-FOUC <script>-ът). За разлика от
 * fullscreen — панелът е ~360px, не покрива целия екран; scrim-ът затваря при
 * клик. Темовите --sf-* се пренасят със `themeStyle`, защото в <body> темата
 * на <div data-storefront> не е налична.
 */
export function MobileMenu({
  shop,
  settings,
  base,
  nav,
  open,
  onClose,
  desktopVisible = false,
}: {
  shop: Shop;
  settings: SiteSettings;
  base: string;
  nav: NavItem[];
  open: boolean;
  onClose: () => void;
  /** Минимал вариантът показва drawer-а и на десктоп; иначе е само мобилно. */
  desktopVisible?: boolean;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    /* queueMicrotask: синхронен setState в effect чупи react-compiler lint. */
    queueMicrotask(() => setContainer(el));
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  /* Държим drawer-а монтиран докато свърши exit анимацията: `render` следва
     `open` с изпреварване за enter и закъснение за exit. `shown` контролира
     transition-а (translateX/opacity) — вдига се RAF след монтиране. */
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    /* Отложените setState (RAF/микротаск/таймер) минават react-compiler lint-а
       и служат за анимацията: enter → монтирай, после RAF вдига `shown`;
       exit → свали `shown`, после изчакай transition-а преди unmount. */
    if (open) {
      let raf = 0;
      queueMicrotask(() => {
        setRender(true);
        raf = requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    queueMicrotask(() => setShown(false));
    const t = setTimeout(() => setRender(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    /* Заключваме скрола и компенсираме изчезналия скролбар с padding — иначе
       layout-ът скача надясно с ширината му. Пипаме <html> (scroll container).
       Drawer-ът е в собствен portal контейнер, не в storefront дървото, така
       че това не влияе на sticky header-а. */
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const prevOverflow = root.style.overflow;
    const prevPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prevOverflow;
      root.style.paddingRight = prevPadding;
      window.removeEventListener("keydown", onKey);
    };
  }, [render, onClose]);

  if (!render || !container) return null;

  return createPortal(
    <div
      data-storefront
      style={themeStyle(settings)}
      className={`fixed inset-0 z-100 ${desktopVisible ? "" : "md:hidden"}`}
    >
      {/* Scrim — fade in/out, затваря при клик */}
      <button
        type="button"
        aria-label="Затвори менюто"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Панел отдясно — плъзга се навътре/навън */}
      <aside
        /* pb env(): при notch/home-indicator (standalone) долният ред не
           попада под системната зона (R6 от одита; 0 в обикновен браузър). */
        className={`absolute inset-y-0 right-0 flex w-[min(360px,85vw)] flex-col bg-(--sf-bg) pb-[env(safe-area-inset-bottom)] text-(--sf-text) shadow-(--sf-shadow) transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-19 shrink-0 items-center justify-between border-b border-(--sf-border) px-5">
          <Brand shop={shop} base={base} logoOnly={settings.logoOnly} />
          <button
            type="button"
            aria-label="Затвори менюто"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-(--sf-radius) transition-opacity hover:opacity-70"
          >
            <Icon name="x" size={24} />
          </button>
        </div>
        <nav
          aria-label="Навигация"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-5 py-6"
        >
          {nav.map((item, i) => {
            const cls =
              "sf-rise flex min-h-13 items-center border-b border-(--sf-border) text-2xl tracking-tight [font-family:var(--sf-font-heading)] font-(--sf-heading-weight)";
            const style = { "--sf-stagger": i } as CSSProperties;
            return item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={cls}
                style={style}
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} onClick={onClose} className={cls} style={style}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {shop.city && (
          <p className="shrink-0 px-5 pb-6 text-sm uppercase tracking-[0.2em] text-(--sf-muted)">
            {shop.city}
          </p>
        )}
      </aside>
    </div>,
    container,
  );
}

/** Бургер бутон — отваря мобилното (и в мин. вариант — десктоп) меню. */
export function MenuButton({ onOpen, expanded }: { onOpen: () => void; expanded: boolean }) {
  return (
    <button
      type="button"
      aria-label="Отвори менюто"
      aria-expanded={expanded}
      onClick={onOpen}
      className="flex size-11 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="menu" size={24} />
    </button>
  );
}

/** S3-глобален: профил икона в хедъра → глобалният /account (не per-магазин). */
export function AccountButton({ loggedIn }: { base?: string; loggedIn: boolean }) {
  const href = loggedIn ? "/account" : "/auth/login?role=buyer&next=/account";
  return (
    <Link
      href={href}
      aria-label={loggedIn ? "Моят профил" : "Вход"}
      className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="user" size={22} />
    </Link>
  );
}

export { CartButton };
export { FavoritesButton } from "../favorites-button";
export { HeaderSearch } from "./header-search";
