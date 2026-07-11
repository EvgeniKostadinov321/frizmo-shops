"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { saveProduct } from "@/actions/products";
import { AttributesEditor, type AttributeRow } from "./attributes-editor";
import { ImageUploader } from "./image-uploader";
import { OptionsEditor } from "./options-editor";
import { VariantsTable } from "./variants-table";
import {
  Button,
  Card,
  Checkbox,
  Icon,
  Input,
  LinkButton,
  PriceInput,
  Select,
  Textarea,
} from "@/components/ui";
import {
  generateCombinations,
  mergeVariants,
  type OptionAxis,
  type VariantDraft,
} from "@/lib/variants";

export interface ProductFormInitial {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  promoPrice: string;
  stock: string;
  status: "active" | "inactive";
  images: string[];
  attributes: AttributeRow[];
  options: OptionAxis[];
  variants: VariantDraft[];
  deal: { quantity: string; totalPrice: string } | null;
  weight: string;
  length: string;
  width: string;
  height: string;
  netQuantityValue: string;
  netQuantityUnit: string;
}

interface ProductFormProps {
  productId?: string;
  initial?: ProductFormInitial;
  categories: { value: string; label: string }[];
  /** Опростен режим за onboarding: без характеристики и варианти. */
  simple?: boolean;
  redirectTo?: string;
}

const emptyInitial: ProductFormInitial = {
  name: "",
  description: "",
  categoryId: "",
  price: "",
  promoPrice: "",
  stock: "",
  status: "active",
  images: [],
  attributes: [],
  options: [],
  variants: [],
  deal: null,
  weight: "",
  length: "",
  width: "",
  height: "",
  netQuantityValue: "",
  netQuantityUnit: "g",
};

export function ProductForm({
  productId,
  initial = emptyInitial,
  categories,
  simple = false,
  redirectTo = "/dashboard/products",
}: ProductFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [price, setPrice] = useState(initial.price);
  const [promoPrice, setPromoPrice] = useState(initial.promoPrice);
  const [stock, setStock] = useState(initial.stock);
  const [active, setActive] = useState(initial.status === "active");
  const [images, setImages] = useState<string[]>(initial.images);
  const [attributes, setAttributes] = useState<AttributeRow[]>(initial.attributes);
  const [axes, setAxes] = useState<OptionAxis[]>(initial.options);
  const [variants, setVariants] = useState<VariantDraft[]>(initial.variants);
  const [deal, setDeal] = useState(initial.deal);
  const [weight, setWeight] = useState(initial.weight);
  const [length, setLength] = useState(initial.length);
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);
  const [netQuantityValue, setNetQuantityValue] = useState(initial.netQuantityValue);
  const [netQuantityUnit, setNetQuantityUnit] = useState(initial.netQuantityUnit);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function handleAxesChange(nextAxes: OptionAxis[]) {
    setAxes(nextAxes);
    setVariants(mergeVariants(generateCombinations(nextAxes), variants));
  }

  function handleImagesChange(nextImages: string[]) {
    setImages(nextImages);
    /* Премахната снимка изчезва и от вариантите */
    const imageSet = new Set(nextImages);
    setVariants(
      variants.map((v) => ({
        ...v,
        imagePaths: v.imagePaths.filter((p) => imageSet.has(p)),
      })),
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setFieldErrors({});
    try {
      const cleanAxes = axes.filter((a) => a.name.trim() && a.values.length > 0);
      const result = await saveProduct(productId ?? null, {
        name,
        description,
        categoryId,
        price,
        promoPrice,
        stock,
        status: active ? "active" : "inactive",
        images,
        attributes: attributes.filter((a) => a.name.trim() || a.value.trim()),
        options: cleanAxes,
        variants: variants.map(({ options, price, stock, sku, imagePaths }) => ({
          options,
          price,
          stock,
          sku,
          imagePaths,
        })),
        deal: deal ? { quantity: deal.quantity, totalPrice: deal.totalPrice } : null,
        weight,
        length,
        width,
        height,
        netQuantity:
          netQuantityValue.trim() === ""
            ? null
            : { value: netQuantityValue, unit: netQuantityUnit || "g" },
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(productId ? "Продуктът е запазен." : "Продуктът е създаден.");
      router.push(redirectTo);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      noValidate
    >
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Основни</h2>
        <Input
          label="Име на продукта"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        {/* В onboarding (simple) още няма категории — полето само би обърквало;
            добавят се по-късно от таб „Категории". */}
        {!simple &&
          (categories.length > 0 ? (
            <Select
              label="Категория"
              options={categories}
              placeholder="— Без категория —"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              error={fieldErrors.categoryId}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-900">Категория</span>
              <div className="flex flex-col gap-2 rounded-control border border-dashed border-surface-300 bg-surface-50 p-4">
                <p className="text-sm text-ink-500">
                  Още нямаш категории. Създай няколко, за да подредиш продуктите си.
                </p>
                <div>
                  <LinkButton href="/dashboard/categories" variant="secondary" size="sm">
                    <Icon name="plus" size={16} />
                    Добави категории
                  </LinkButton>
                </div>
              </div>
            </div>
          ))}
        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.description}
        />
        <Checkbox
          label="Активен (вижда се в магазина)"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Цена и наличност</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceInput
            label="Цена"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={fieldErrors.price}
          />
          <PriceInput
            label="Промо цена"
            value={promoPrice}
            onChange={(e) => setPromoPrice(e.target.value)}
            error={fieldErrors.promoPrice}
            hint="Празно = без промоция"
          />
          <Input
            label="Наличност"
            type="number"
            min={0}
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={fieldErrors.stock}
            hint="Празно = не се следи"
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Снимки</h2>
        <p className="text-sm text-ink-500">До 8 снимки, първата е корицата.</p>
        <ImageUploader images={images} onChange={handleImagesChange} />
        {fieldErrors.images && <p className="text-sm text-danger-600">{fieldErrors.images}</p>}
      </Card>

      {!simple && (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-ink-900">Тегло и размер</h2>
              <p className="text-sm text-ink-500">
                По избор. Попълни тегло и размери, за да смятаме автоматично цена за
                доставка с Еконт и Спиди по-късно. Иначе ползвай фиксирана цена на доставка.
              </p>
            </div>

            <div className="flex flex-col gap-1 sm:max-w-xs">
              <Input
                label="Тегло (грамове)"
                hint="Тегло на пратката — за доставка (Еконт/Спиди). Клиентът не го вижда."
                type="number"
                min={1}
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                error={fieldErrors.weight}
              />
              {Number(weight) >= 1000 && (
                <p className="text-sm text-ink-500">
                  = {(Number(weight) / 1000).toFixed(1).replace(".", ",")} кг
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-900">Размери (см, по избор)</span>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Дължина"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  error={fieldErrors.length}
                />
                <Input
                  label="Ширина"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  error={fieldErrors.width}
                />
                <Input
                  label="Височина"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  error={fieldErrors.height}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-900">Количество (по избор)</span>
              <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
                <Input
                  label="Стойност"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={netQuantityValue}
                  onChange={(e) => setNetQuantityValue(e.target.value)}
                />
                <Select
                  label="Единица"
                  options={[
                    { value: "mg", label: "милиграм (мг)" },
                    { value: "g", label: "грам (г)" },
                    { value: "kg", label: "килограм (кг)" },
                    { value: "ml", label: "милилитър (мл)" },
                    { value: "l", label: "литър (л)" },
                  ]}
                  value={netQuantityUnit}
                  onChange={(e) => setNetQuantityUnit(e.target.value)}
                />
              </div>
              <p className="text-sm text-ink-500">
                Нетно съдържание — това вижда клиентът (напр. 500 мл, 250 г, 1 кг).
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900">Промоция „купи повече“</h2>
            <Checkbox
              label="Количествена промоция"
              hint="Например: купи 2 броя за обща цена 30 €. При достигнат брой замества промо цената."
              checked={deal !== null}
              onChange={(e) => setDeal(e.target.checked ? { quantity: "2", totalPrice: "" } : null)}
            />
            {deal && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Купи (брой)"
                  type="number"
                  min={2}
                  max={50}
                  inputMode="numeric"
                  value={deal.quantity}
                  onChange={(e) => setDeal({ ...deal, quantity: e.target.value })}
                  error={fieldErrors.deal}
                />
                <PriceInput
                  label="За обща цена"
                  value={deal.totalPrice}
                  onChange={(e) => setDeal({ ...deal, totalPrice: e.target.value })}
                />
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900">Характеристики</h2>
            <AttributesEditor attributes={attributes} onChange={setAttributes} />
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-ink-900">Опции и варианти</h2>
            <OptionsEditor axes={axes} onChange={handleAxesChange} />
            <VariantsTable
              variants={variants}
              productImages={images}
              basePrice={price}
              onChange={setVariants}
            />
          </Card>
        </>
      )}

      {/* Футерът е отделна карта с горен отстъп — не се слива с последната
          секция (feedback от 2026-07-04, снимка от мобилно). */}
      <div className="mt-2 flex items-center gap-3 rounded-card border border-surface-200 bg-surface-0 p-4">
        <Button type="submit" loading={saving}>
          {productId ? "Запази промените" : "Създай продукта"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(redirectTo)}>
          Отказ
        </Button>
      </div>
    </form>
  );
}
