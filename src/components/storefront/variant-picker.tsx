"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { ProductOption, ProductVariant } from "@/db";
import {
  addToCart,
  getCartSnapshot,
  getServerCartSnapshot,
  onCartChange,
} from "@/lib/cart-storage";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import { variantKey } from "@/lib/variants";
import { Icon } from "@/components/ui";
import { openCartDrawer } from "@/components/storefront/cart-drawer";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { discountPercent } from "@/components/storefront/product-card";

interface VariantPickerProps {
  shopId: string;
  productId: string;
  productName: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  baseStock: number | null;
  images: string[];
  options: ProductOption[];
  variants: ProductVariant[];
  /** Промоция „купи N за X" — показва се като бадж и влиза в живото „Общо". */
  deal: { quantity: number; totalPriceCents: number } | null;
  /** Категория за kicker-а над заглавието (линк към филтрирания каталог). */
  category: { name: string; href: string } | null;
  /** Допълнителни блокове (марка, доставка, trust) под CTA — пълнят дясната
   *  колона до нивото на снимката, за да няма празнина на десктоп. */
  sidebar?: ReactNode;
}

/** Общо за qty бройки: deal групите по deal цена, остатъкът по единичната —
 *  СЪЩАТА формула като pricing engine-а (сървърът винаги преизчислява). */
function lineTotal(
  unitCents: number,
  qty: number,
  deal: { quantity: number; totalPriceCents: number } | null,
): number {
  if (deal && deal.quantity >= 2 && qty >= deal.quantity) {
    const groups = Math.floor(qty / deal.quantity);
    return groups * deal.totalPriceCents + (qty % deal.quantity) * unitCents;
  }
  return unitCents * qty;
}

/**
 * Галерия + избор на вариант. Заглавието и цената живеят ТУК (дясната колона)
 * — на десктоп името стои до цената си, не над снимката. Галерията е
 * swipe-ваща (scroll-snap) с lightbox; на мобилно има sticky CTA лента.
 */
export function VariantPicker({
  shopId,
  productId,
  productName,
  basePriceCents,
  promoPriceCents,
  baseStock,
  images,
  options,
  variants,
  deal,
  category,
  sidebar,
}: VariantPickerProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);

  const selectedVariant = useMemo(() => {
    if (options.length === 0 || Object.keys(selection).length !== options.length) return null;
    const key = variantKey(selection);
    return variants.find((v) => variantKey(v.options) === key) ?? null;
  }, [selection, options.length, variants]);

  const priceCents = selectedVariant?.priceCents ?? basePriceCents;
  const stock = selectedVariant ? selectedVariant.stock : baseStock;
  const outOfStock = stock !== null && stock <= 0;
  /* Промо само при реална отстъпка (promo < цена) и когато вариантът няма
     собствена цена — иначе баджът показва „−0%"/отрицателно. */
  const showPromo =
    promoPriceCents !== null &&
    promoPriceCents < priceCents &&
    selectedVariant?.priceCents == null;
  const effectivePriceCents = showPromo ? promoPriceCents : priceCents;

  /* Оставащата наличност е жива: наличност − каквото вече е в количката. */
  const cartLines = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const currentVariantKey = selectedVariant ? variantKey(selectedVariant.options) : null;
  const inCart =
    cartLines.find((l) => l.productId === productId && l.variantKey === currentVariantKey)
      ?.qty ?? 0;
  const remaining = stock === null ? null : Math.max(0, stock - inCart);
  const allInCart = !outOfStock && remaining !== null && remaining <= 0;
  const effectiveQty = remaining === null ? qty : Math.min(qty, Math.max(1, remaining));
  const canBuy = !outOfStock && !allInCart;
  const addDisabled = options.length > 0 && !selectedVariant;

  const orderedImages = useMemo(() => {
    const variantImages = selectedVariant?.imagePaths ?? [];
    if (variantImages.length === 0) return images;
    const rest = images.filter((p) => !variantImages.includes(p));
    return [...variantImages, ...rest];
  }, [images, selectedVariant]);

  const clampedIndex = Math.min(activeImage, Math.max(0, orderedImages.length - 1));

  /* Програмна смяна (thumbnail/вариант) → скролваме лентата до слайда.
     Скролът не е setState — безопасен в effect. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = el.clientWidth * clampedIndex;
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: "instant" });
  }, [clampedIndex, orderedImages]);

  /* Swipe → активният индекс следва скрола (rAF-дроселирано). */
  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setActiveImage((cur) => (cur === i ? cur : i));
    });
  }

  function select(optionName: string, value: string) {
    setSelection((prev) => ({ ...prev, [optionName]: value }));
    setActiveImage(0);
  }

  /* Живото „Общо": qty × ефективната цена, с приложен deal (същата формула
     като сървърния pricing engine). */
  const totalCents = lineTotal(effectivePriceCents, effectiveQty, deal);
  const savedCents = effectivePriceCents * effectiveQty - totalCents;

  function add() {
    addToCart(shopId, { productId, variantKey: currentVariantKey, qty: effectiveQty });
    setQty(1);
    toast.success(
      effectiveQty > 1 ? `Добавени ${effectiveQty} бр в количката.` : "Добавено в количката.",
      { action: { label: "Виж количката", onClick: openCartDrawer } },
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-10">
      {/* ГАЛЕРИЯ: swipe лента със snap + lightbox */}
      <div className="flex flex-col gap-3">
        <div className="sf-frame relative overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface)">
          {orderedImages.length > 0 ? (
            <div
              ref={scrollerRef}
              onScroll={onScroll}
              className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
              aria-label="Снимки на продукта"
            >
              {orderedImages.map((path, i) => (
                <button
                  key={path}
                  type="button"
                  aria-label={`Увеличи снимка ${i + 1}`}
                  onClick={() => lightboxRef.current?.showModal()}
                  className="relative aspect-square w-full shrink-0 cursor-zoom-in snap-center"
                >
                  <Image
                    src={publicImageUrl(path)}
                    alt={i === 0 ? productName : ""}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                </button>
              ))}
            </div>
          ) : (
            <span className="flex aspect-square w-full items-center justify-center" aria-hidden>
              <Icon name="image" size={56} className="text-(--sf-muted) opacity-40" />
            </span>
          )}
          {showPromo && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-(--sf-accent) px-3 py-1 text-sm font-bold text-(--sf-on-accent)">
              −{discountPercent(priceCents, promoPriceCents)}%
            </span>
          )}
          {orderedImages.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
              {clampedIndex + 1} / {orderedImages.length}
            </span>
          )}
        </div>

        {orderedImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {orderedImages.map((path, i) => (
              <button
                key={path}
                type="button"
                aria-label={`Снимка ${i + 1}`}
                aria-current={i === clampedIndex ? "true" : undefined}
                onClick={() => setActiveImage(i)}
                className={`relative size-16 shrink-0 overflow-hidden rounded-(--sf-radius) border-2 transition-colors ${
                  i === clampedIndex
                    ? "border-(--sf-primary)"
                    : "border-(--sf-border) opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={publicImageUrl(path)} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ДЯСНА КОЛОНА: kicker + заглавие + цена + варианти + CTA */}
      <div className="flex flex-col gap-4">
        <div>
          {category && (
            <Link
              href={category.href}
              className="mb-2 inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary) hover:underline"
            >
              {category.name}
            </Link>
          )}
          <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] text-(--sf-text)">
            {productName}
          </h1>
        </div>

        <p className="text-3xl font-bold text-(--sf-primary)">
          {showPromo ? (
            <>
              {formatPrice(promoPriceCents)}{" "}
              <s className="text-lg font-normal text-(--sf-muted)">{formatPrice(priceCents)}</s>
            </>
          ) : (
            formatPrice(priceCents)
          )}
        </p>

        {options.map((option) => (
          <fieldset key={option.id}>
            <legend className="mb-2 text-sm font-medium text-(--sf-text)">{option.name}</legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selection[option.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => select(option.name, value)}
                    className={`flex h-11 items-center rounded-(--sf-radius) border px-4 text-sm transition-colors ${
                      active
                        ? "border-(--sf-primary) bg-(--sf-primary) text-(--sf-on-primary)"
                        : "border-(--sf-border) text-(--sf-text) hover:border-(--sf-primary)"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {options.length > 0 && !selectedVariant && (
          <p className="text-sm text-(--sf-muted)">
            Избери {options.map((o) => o.name.toLowerCase()).join(" и ")}.
          </p>
        )}

        {outOfStock ? (
          <p className="font-medium text-(--sf-muted)">Изчерпано</p>
        ) : allInCart ? (
          <p className="text-sm font-medium text-(--sf-accent)">
            Цялата наличност е в количката ти.
          </p>
        ) : remaining !== null && remaining <= 5 ? (
          <p className="text-sm text-(--sf-accent)" aria-live="polite">
            {inCart > 0 ? `Можеш да добавиш още ${remaining} бр.` : `Остават само ${remaining} бр.`}
          </p>
        ) : null}

        {deal && (
          <p className="rounded-(--sf-radius) bg-(--sf-surface) px-3 py-2 text-sm font-medium text-(--sf-accent)">
            Купи {deal.quantity} бр за общо {formatPrice(deal.totalPriceCents)}
          </p>
        )}

        {canBuy && (effectiveQty > 1 || savedCents > 0) && (
          <div className="flex items-baseline justify-between gap-3 rounded-(--sf-radius) bg-(--sf-surface) px-3 py-2.5">
            <span className="text-sm text-(--sf-muted)">Общо за {effectiveQty} бр</span>
            <span className="text-right">
              <span className="text-xl font-bold text-(--sf-text)">{formatPrice(totalCents)}</span>
              {savedCents > 0 && (
                <span className="block text-xs font-medium text-(--sf-accent)">
                  Спестяваш {formatPrice(savedCents)}
                </span>
              )}
            </span>
          </div>
        )}

        {canBuy && (
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-(--sf-radius) border border-(--sf-border)">
              <button
                type="button"
                aria-label="Намали количеството"
                onClick={() => setQty(Math.max(1, effectiveQty - 1))}
                className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70"
              >
                −
              </button>
              <span aria-live="polite" className="w-8 text-center font-medium text-(--sf-text)">
                {effectiveQty}
              </span>
              <button
                type="button"
                aria-label="Увеличи количеството"
                disabled={remaining !== null && effectiveQty >= remaining}
                onClick={() => setQty(Math.min(remaining ?? 999, effectiveQty + 1))}
                className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={addDisabled}
              onClick={add}
              className="sf-cta h-12 flex-1 rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Добави в количката
            </button>
            <FavoriteButton shopId={shopId} productId={productId} variant="page" />
          </div>
        )}

        {sidebar}
      </div>

      {/* STICKY CTA (само мобилно): цената + „Добави" винаги под палеца.
          Spacer-ът пази съдържанието да не остане под лентата. */}
      {canBuy && (
        <>
          <div aria-hidden className="col-span-full h-2 md:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-(--sf-border) bg-(--sf-surface-raised)/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-(--sf-muted)">
                  {effectiveQty > 1 ? `${effectiveQty} бр · ${productName}` : productName}
                </span>
                <span className="text-lg font-bold text-(--sf-primary)">
                  {formatPrice(totalCents)}
                </span>
              </span>
              <button
                type="button"
                disabled={addDisabled}
                onClick={add}
                className="sf-cta h-11 rounded-(--sf-radius) bg-(--sf-primary) px-5 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addDisabled ? "Избери вариант" : "Добави"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* LIGHTBOX: нативен <dialog>, клик на фона затваря */}
      <dialog
        ref={lightboxRef}
        onClick={(e) => {
          if (e.target === lightboxRef.current) lightboxRef.current?.close();
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-transparent backdrop:bg-black/85"
        aria-label="Преглед на снимка"
      >
        <div className="pointer-events-none flex h-full w-full items-center justify-center p-4 sm:p-12">
          {orderedImages[clampedIndex] && (
            <div className="pointer-events-auto relative h-full w-full max-w-5xl">
              <Image
                src={publicImageUrl(orderedImages[clampedIndex])}
                alt={productName}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          )}
          <button
            type="button"
            aria-label="Затвори"
            onClick={() => lightboxRef.current?.close()}
            className="pointer-events-auto absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <Icon name="x" size={22} />
          </button>
          {orderedImages.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Предишна снимка"
                onClick={() =>
                  setActiveImage((clampedIndex - 1 + orderedImages.length) % orderedImages.length)
                }
                className="pointer-events-auto absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Icon name="chevron-down" size={22} className="rotate-90" />
              </button>
              <button
                type="button"
                aria-label="Следваща снимка"
                onClick={() => setActiveImage((clampedIndex + 1) % orderedImages.length)}
                className="pointer-events-auto absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Icon name="chevron-down" size={22} className="-rotate-90" />
              </button>
              <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                {clampedIndex + 1} / {orderedImages.length}
              </span>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
