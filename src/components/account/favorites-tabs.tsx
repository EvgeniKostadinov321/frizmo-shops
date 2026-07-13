"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product, Shop } from "@/db";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

type FavProduct = Product & { shopName: string; shopSlug: string };

/** Любими: табове „Продукти" / „Магазини" (глобално, платформени токени). */
export function FavoritesTabs({ products, shops }: { products: FavProduct[]; shops: Shop[] }) {
  const [tab, setTab] = useState<"products" | "shops">("products");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${tab === "products" ? "bg-ink-900 text-white" : "bg-surface-100 text-ink-700"}`}
        >
          Продукти ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("shops")}
          className={`rounded-control px-3 py-1.5 text-sm font-medium ${tab === "shops" ? "bg-ink-900 text-white" : "bg-surface-100 text-ink-700"}`}
        >
          Магазини ({shops.length})
        </button>
      </div>
      {tab === "products" ? (
        products.length === 0 ? (
          <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">
            Още нямаш любими продукти.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/s/${p.shopSlug}/p/${p.slug}`}
                  className="flex gap-3 rounded-card border border-surface-200 bg-surface-0 p-3 transition-colors hover:border-brand-600"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{p.name}</p>
                    <p className="text-xs text-ink-500">{p.shopName}</p>
                    <p className="mt-1 text-sm font-medium text-ink-900">{formatPrice(p.priceCents)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : shops.length === 0 ? (
        <p className="rounded-card border border-surface-200 bg-surface-0 p-6 text-center text-sm text-ink-500">
          Още нямаш любими магазини.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shops.map((s) => (
            <li key={s.id}>
              <Link
                href={`/s/${s.slug}`}
                className="flex items-center gap-3 rounded-card border border-surface-200 bg-surface-0 p-3 transition-colors hover:border-brand-600"
              >
                {s.logoPath ? (
                  <Image
                    src={publicImageUrl(s.logoPath)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-surface-100 font-bold text-ink-700">
                    {s.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">{s.name}</p>
                  {s.city && <p className="truncate text-xs text-ink-500">{s.city}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
