"use client";

import Image from "next/image";
import { Input, PriceInput, Table, TBody, TCell, TH, THead, TRow } from "@/components/ui";
import { publicImageUrl } from "@/lib/storage";
import type { VariantDraft } from "@/lib/variants";

interface VariantsTableProps {
  variants: VariantDraft[];
  productImages: string[];
  basePrice: string;
  onChange: (variants: VariantDraft[]) => void;
}

export function VariantsTable({
  variants,
  productImages,
  basePrice,
  onChange,
}: VariantsTableProps) {
  if (variants.length === 0) return null;

  function update(index: number, patch: Partial<VariantDraft>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function toggleImage(index: number, path: string) {
    const variant = variants[index]!;
    const selected = variant.imagePaths.includes(path)
      ? variant.imagePaths.filter((p) => p !== path)
      : [...variant.imagePaths, path];
    update(index, { imagePaths: selected });
  }

  function label(options: Record<string, string>): string {
    return Object.values(options).join(" / ");
  }

  return (
    <Table>
      <THead>
        <TH>Вариант</TH>
        <TH>Цена</TH>
        <TH>Наличност</TH>
        <TH>
          <abbr
            title="Складов код — твой вътрешен номер на артикула (напр. TEN-M-SIN). По избор."
            className="cursor-help no-underline"
          >
            Код (SKU)
          </abbr>
        </TH>
        {productImages.length > 0 && <TH>Снимки</TH>}
      </THead>
      <TBody>
        {variants.map((variant, i) => (
          <TRow key={label(variant.options)}>
            <TCell className="font-medium">{label(variant.options)}</TCell>
            <TCell className="min-w-28">
              <PriceInput
                label={`Цена за ${label(variant.options)}`}
                hideLabel
                placeholder={basePrice || "0,00"}
                value={variant.price}
                onChange={(e) => update(i, { price: e.target.value })}
              />
            </TCell>
            <TCell className="min-w-24">
              <Input
                label={`Наличност за ${label(variant.options)}`}
                hideLabel
                type="number"
                min={0}
                placeholder="—"
                value={variant.stock}
                onChange={(e) => update(i, { stock: e.target.value })}
              />
            </TCell>
            <TCell className="min-w-28">
              <Input
                label={`Складов код за ${label(variant.options)}`}
                hideLabel
                placeholder="напр. TEN-M"
                value={variant.sku}
                onChange={(e) => update(i, { sku: e.target.value })}
              />
            </TCell>
            {productImages.length > 0 && (
              <TCell>
                <div className="flex gap-1">
                  {productImages.map((path) => {
                    const selected = variant.imagePaths.includes(path);
                    return (
                      <button
                        key={path}
                        type="button"
                        aria-label={selected ? "Премахни снимката от варианта" : "Добави снимката към варианта"}
                        aria-pressed={selected}
                        onClick={() => toggleImage(i, path)}
                        className={`relative size-10 overflow-hidden rounded-control border-2 transition-colors ${
                          selected ? "border-brand-600" : "border-surface-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={publicImageUrl(path)}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </TCell>
            )}
          </TRow>
        ))}
      </TBody>
    </Table>
  );
}
