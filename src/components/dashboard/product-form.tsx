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
  Input,
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
        {!simple && (
          <Select
            label="Категория"
            options={categories}
            placeholder="— Без категория —"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            error={fieldErrors.categoryId}
          />
        )}
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

      <div className="flex items-center gap-3">
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
