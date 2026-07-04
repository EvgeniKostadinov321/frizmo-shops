"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteProduct, toggleProductStatus } from "@/actions/products";
import type { Product } from "@/db";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Input,
  LinkButton,
  Select,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";

interface ProductListProps {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  categories: { value: string; label: string }[];
}

export function ProductList({ items, total, page, pageSize, categories }: ProductListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  /* Търсене с debounce през URL-а */
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => setParam("search", search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleToggle(product: Product) {
    const result = await toggleProductStatus({ id: product.id });
    if (!result.ok) toast.error(result.error);
    router.refresh();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteProduct({ id: toDelete.id });
    if (!result.ok) toast.error(result.error);
    else toast.success("Продуктът е изтрит.");
    router.refresh();
  }

  const categoryLabels = new Map(categories.map((c) => [c.value, c.label]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Търсене"
          hideLabel
          placeholder="Търси по име..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Категория"
          hideLabel
          options={categories}
          placeholder="Всички категории"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => setParam("category", e.target.value)}
        />
        <Select
          label="Статус"
          hideLabel
          options={[
            { value: "active", label: "Активни" },
            { value: "inactive", label: "Неактивни" },
          ]}
          placeholder="Всички статуси"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="store"
          title={total === 0 && !searchParams.toString() ? "Още нямаш продукти" : "Няма резултати"}
          description="Добави продукт и той ще се появи тук."
          action={<LinkButton href="/dashboard/products/new">Добави продукт</LinkButton>}
        />
      ) : (
        <>
          {/* Мобилно: карти (таблицата е за десктоп) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((product) => (
              <li
                key={product.id}
                className="flex gap-3 rounded-card border border-surface-200 bg-surface-0 p-3"
              >
                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="relative size-16 shrink-0 overflow-hidden rounded-control border border-surface-200 bg-surface-50"
                >
                  {product.images[0] ? (
                    <Image
                      src={publicImageUrl(product.images[0])}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-surface-300">
                      <Icon name="image" size={24} />
                    </span>
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="truncate font-medium text-ink-900 hover:text-brand-600"
                  >
                    {product.name}
                  </Link>
                  <span className="text-xs text-ink-500">
                    {product.categoryId ? (categoryLabels.get(product.categoryId) ?? "—") : "Без категория"}
                  </span>
                  <span className="text-sm font-medium text-ink-900">
                    {product.promoPriceCents !== null ? (
                      <>
                        <span className="text-danger-600">{formatPrice(product.promoPriceCents)}</span>{" "}
                        <s className="text-xs text-ink-500">{formatPrice(product.priceCents)}</s>
                      </>
                    ) : (
                      formatPrice(product.priceCents)
                    )}
                    <span className="text-ink-500"> · {product.stock ?? "—"} бр.</span>
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => handleToggle(product)} aria-label="Смени статуса">
                      <Badge tone={product.status === "active" ? "success" : "neutral"}>
                        {product.status === "active" ? "Активен" : "Неактивен"}
                      </Badge>
                    </button>
                    <span className="flex-1" />
                    <Link href={`/dashboard/products/${product.id}`}>
                      <Button variant="ghost" size="sm" aria-label="Редактирай">
                        <Icon name="pencil" size={18} />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Изтрий"
                      onClick={() => setToDelete(product)}
                    >
                      <Icon name="trash" size={18} />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Десктоп: таблица */}
          <Table className="hidden md:block">
            <THead>
              <TH>Продукт</TH>
              <TH>Категория</TH>
              <TH>Цена</TH>
              <TH>Наличност</TH>
              <TH>Статус</TH>
              <TH aria-label="Действия" />
            </THead>
            <TBody>
              {items.map((product) => (
                <TRow key={product.id}>
                  <TCell>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="flex items-center gap-3 font-medium hover:text-brand-600"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-control border border-surface-200 bg-surface-50">
                        {product.images[0] ? (
                          <Image
                            src={publicImageUrl(product.images[0])}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-surface-300">
                            <Icon name="image" size={20} />
                          </span>
                        )}
                      </span>
                      <span className="max-w-56 truncate">{product.name}</span>
                    </Link>
                  </TCell>
                  <TCell className="text-ink-500">
                    {product.categoryId ? (categoryLabels.get(product.categoryId) ?? "—") : "—"}
                  </TCell>
                  <TCell>
                    {product.promoPriceCents !== null ? (
                      <span>
                        <span className="font-medium text-danger-600">
                          {formatPrice(product.promoPriceCents)}
                        </span>{" "}
                        <s className="text-xs text-ink-500">{formatPrice(product.priceCents)}</s>
                      </span>
                    ) : (
                      formatPrice(product.priceCents)
                    )}
                  </TCell>
                  <TCell>{product.stock ?? "—"}</TCell>
                  <TCell>
                    <button
                      type="button"
                      onClick={() => handleToggle(product)}
                      aria-label="Смени статуса"
                    >
                      <Badge tone={product.status === "active" ? "success" : "neutral"}>
                        {product.status === "active" ? "Активен" : "Неактивен"}
                      </Badge>
                    </button>
                  </TCell>
                  <TCell>
                    <div className="flex justify-end gap-1">
                      <Link href={`/dashboard/products/${product.id}`}>
                        <Button variant="ghost" size="sm" aria-label="Редактирай">
                          <Icon name="pencil" size={18} />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Изтрий"
                        onClick={() => setToDelete(product)}
                      >
                        <Icon name="trash" size={18} />
                      </Button>
                    </div>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
              >
                ← Предишна
              </Button>
              <span className="text-sm text-ink-500">
                Страница {page} от {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setParam("page", String(page + 1))}
              >
                Следваща →
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        message={`Изтриване на „${toDelete?.name}"? Действието е необратимо, снимките също ще бъдат изтрити.`}
      />
    </div>
  );
}
