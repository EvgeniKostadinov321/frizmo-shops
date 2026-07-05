"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";
import { MascotState } from "@/components/storefront/mascot";
import { priceCartAction } from "@/actions/cart";
import { formatPrice } from "@/lib/money";
import {
  getCartSnapshot,
  getServerCartSnapshot,
  onCartChange,
  removeFromCart,
  setCartQty,
} from "@/lib/cart-storage";
import type { PricedLine } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/storage";

const LINE_ERROR_LABELS: Record<string, string> = {
  not_found: "Продуктът вече не съществува",
  inactive: "Продуктът вече не се предлага",
  variant_missing: "Този вариант вече не се предлага",
  out_of_stock: "Изчерпан",
  insufficient_stock: "Няма достатъчно наличност",
  invalid_qty: "Невалидно количество",
};

interface CartViewProps {
  shopId: string;
  slug: string;
  base: string;
  /** Най-ниският праг за безплатна доставка на магазина (null = няма такъв). */
  freeShippingOverCents: number | null;
  /** В mini-cart drawer-а: затваря панела при навигация от линк. */
  onNavigate?: () => void;
}

const lineKey = (l: { productId: string; variantKey: string | null }) =>
  `${l.productId}|${l.variantKey ?? ""}`;

/** Сървърните данни за ред, закачени по ключ (не по индекс). */
interface ServerLine {
  priced: PricedLine;
  imagePath: string | null;
  productSlug: string;
}

/**
 * Количка със stale-while-revalidate: количествата и структурата идват ЖИВО
 * от localStorage (нула премигване при +/−), а цените — от сървъра с debounce.
 * Докато отговорът пътува, редовете без deal показват optimistic total
 * (единична × количество); сървърът потвърждава мигове по-късно.
 */
export function CartView({ shopId, slug, base, freeShippingOverCents, onNavigate }: CartViewProps) {
  const stored = useSyncExternalStore(
    (cb) => onCartChange(shopId, cb),
    () => getCartSnapshot(shopId),
    getServerCartSnapshot,
  );
  const storedKey = JSON.stringify(stored);
  const [server, setServer] = useState<Map<string, ServerLine> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (stored.length === 0) return;
    /* Debounce: серия от +/− кликове = една заявка; и щадим rate limit-а.
       При нова промяна cleanup-ът отменя и таймера, и висящия отговор. */
    let cancelled = false;
    const lines = stored;
    const timer = setTimeout(async () => {
      const result = await priceCartAction(slug, lines);
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      setFailure(null);
      setServer(
        new Map(
          result.data.cart.lines.map((priced, i) => [
            lineKey(priced),
            { priced, imagePath: result.data.views[i]?.imagePath ?? null, productSlug: result.data.views[i]?.productSlug ?? "" },
          ]),
        ),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, storedKey]);

  if (stored.length === 0) {
    return (
      <MascotState
        pose="basket"
        title="Тук е празничко"
        text="Количката ти чака първото си съкровище — разгледай продуктите."
        action={
          <Link
            href={`${base}/products`}
            onClick={onNavigate}
            className="sf-cta inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-5 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
          >
            Към продуктите
          </Link>
        }
      />
    );
  }

  if (failure && !server) {
    return <p className="py-16 text-center text-(--sf-muted)">{failure}</p>;
  }

  if (!server) {
    /* Skeleton САМО при първото зареждане — после старите данни остават видими. */
    return (
      <div className="flex animate-pulse flex-col gap-6" aria-label="Зареждане на количката" role="status">
        <div className="flex flex-col gap-3">
          {stored.map((_, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-3"
            >
              <div className="size-20 shrink-0 rounded-(--sf-radius) bg-(--sf-border)" />
              <div className="flex flex-1 flex-col gap-2 py-1">
                <div className="h-4 w-2/3 rounded bg-(--sf-border)" />
                <div className="h-3 w-1/3 rounded bg-(--sf-border)" />
                <div className="mt-auto h-8 w-24 rounded bg-(--sf-border)" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-40 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface)" />
      </div>
    );
  }

  /* Optimistic редове: количество от localStorage, цени от последния сървърен
     отговор. Deal редовете пазят сървърния total (deal-ът се смята на сървъра). */
  const rows = stored.map((line) => {
    const known = server.get(lineKey(line)) ?? null;
    const priced = known?.priced ?? null;
    const upToDate = priced?.qty === line.qty;
    const lineTotalCents =
      priced && !priced.error
        ? upToDate || priced.appliedDeal
          ? priced.lineTotalCents
          : priced.unitPriceCents * line.qty
        : null;
    return { line, known, priced, lineTotalCents };
  });
  const hasErrors = rows.some((r) => r.priced?.error);
  const subtotalCents = rows.reduce((sum, r) => sum + (r.lineTotalCents ?? 0), 0);
  const freeRemaining =
    freeShippingOverCents !== null ? Math.max(0, freeShippingOverCents - subtotalCents) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {rows.map(({ line, known, priced, lineTotalCents }) => {
          const stockLeft = priced?.stockLeft ?? null;
          const atStockCap = stockLeft !== null && line.qty >= stockLeft;
          return (
            <div
              key={lineKey(line)}
              className={`flex gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-3 ${
                priced?.error ? "opacity-80" : ""
              }`}
            >
              <Link
                href={known?.productSlug ? `${base}/p/${known.productSlug}` : base}
                onClick={onNavigate}
                className="relative size-20 shrink-0 overflow-hidden rounded-(--sf-radius) bg-(--sf-bg)"
              >
                {known?.imagePath ? (
                  <Image
                    src={publicImageUrl(known.imagePath)}
                    alt={priced?.productName ?? ""}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center" aria-hidden>
                    <Icon name="image" size={24} className="text-(--sf-muted) opacity-40" />
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate font-medium text-(--sf-text)">
                  {priced?.productName || "Недостъпен продукт"}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-(--sf-muted)">
                  {priced && !priced.error && (
                    <span>{formatPrice(priced.unitPriceCents)} / бр</span>
                  )}
                  {priced?.variantLabel && <span>{priced.variantLabel}</span>}
                </p>
                {priced?.appliedDeal && (
                  <p className="text-xs font-medium text-(--sf-accent)">{priced.appliedDeal}</p>
                )}
                {priced?.error && (
                  <p className="text-xs font-medium text-(--sf-accent)">
                    {LINE_ERROR_LABELS[priced.error]}
                  </p>
                )}
                {!priced?.error && atStockCap && (
                  <p className="text-xs text-(--sf-accent)" aria-live="polite">
                    Това е цялата наличност ({stockLeft} бр).
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-(--sf-radius) border border-(--sf-border)">
                    <button
                      type="button"
                      aria-label="Намали"
                      onClick={() => setCartQty(shopId, line, line.qty - 1)}
                      className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="w-7 text-center text-sm font-medium text-(--sf-text)">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Увеличи"
                      disabled={atStockCap}
                      onClick={() => setCartQty(shopId, line, line.qty + 1)}
                      className="flex size-11 items-center justify-center text-(--sf-text) hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {lineTotalCents !== null && (
                      <span className="font-bold text-(--sf-text)">
                        {formatPrice(lineTotalCents)}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Премахни от количката"
                      onClick={() => removeFromCart(shopId, line)}
                      className="flex size-11 items-center justify-center text-(--sf-muted) hover:opacity-70"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 shadow-(--sf-shadow)">
        {freeRemaining !== null && freeShippingOverCents !== null && !hasErrors && (
          <div className="flex flex-col gap-1.5 border-b border-(--sf-border) pb-3">
            {freeRemaining > 0 ? (
              <p className="text-sm text-(--sf-text)">
                Още <strong>{formatPrice(freeRemaining)}</strong> до безплатна доставка
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-(--sf-text)">
                <Icon name="check" size={16} className="text-(--sf-primary)" />
                Поръчката ти пътува безплатно
              </p>
            )}
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={freeShippingOverCents}
              aria-valuenow={Math.min(subtotalCents, freeShippingOverCents)}
              aria-label="Прогрес до безплатна доставка"
              className="h-1.5 overflow-hidden rounded-full bg-(--sf-border)"
            >
              <div
                className="h-full rounded-full bg-(--sf-primary) transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, (subtotalCents / freeShippingOverCents) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="flex justify-between text-sm text-(--sf-muted)">
          <span>Междинна сума</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm text-(--sf-muted)">
          <span>Доставка</span>
          <span>избира се при поръчката</span>
        </div>
        <hr className="border-(--sf-border)" />
        <div className="flex justify-between text-lg font-bold text-(--sf-text)">
          <span>Общо без доставка</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <p className="text-xs text-(--sf-muted)">
          Доставката се избира при завършване на поръчката.
        </p>
        {failure && <p className="text-sm font-medium text-(--sf-accent)">{failure}</p>}
        {hasErrors ? (
          <p className="text-sm font-medium text-(--sf-accent)">
            Премахни недостъпните продукти, за да продължиш.
          </p>
        ) : (
          <Link
            href={`${base}/checkout`}
            onClick={onNavigate}
            className="sf-cta inline-flex h-12 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
          >
            Завърши поръчката
          </Link>
        )}
      </div>
    </div>
  );
}
