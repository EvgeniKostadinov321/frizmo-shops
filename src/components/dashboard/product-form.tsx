"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { saveProduct } from "@/actions/products";
import { isVisible, type ComplexityMode } from "@/lib/complexity";
import { AttributesEditor, type AttributeRow } from "./attributes-editor";
import { ImageUploader } from "./image-uploader";
import { OptionsEditor } from "./options-editor";
import { VariantsTable } from "./variants-table";
import {
  Button,
  Card,
  Checkbox,
  Icon,
  InfoHint,
  Input,
  LinkButton,
  PriceInput,
  Select,
  TabPanel,
  Tabs,
  Textarea,
  type TabItem,
} from "@/components/ui";
import {
  generateCombinations,
  mergeVariants,
  type OptionAxis,
  type VariantDraft,
} from "@/lib/variants";
import { isDirty } from "@/lib/is-dirty";

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
  sku: string;
  gtin: string;
  brand: string;
  cost: string;
  seoTitle: string;
  seoDescription: string;
  sizeGuideId: string;
  madeToOrder: boolean;
  leadDaysMin: string;
  leadDaysMax: string;
  madeToOrderCap: string;
}

interface ProductFormProps {
  productId?: string;
  initial?: ProductFormInitial;
  categories: { value: string; label: string }[];
  sizeGuides: { value: string; label: string }[];
  /** Опростен режим за onboarding: без характеристики и варианти. */
  simple?: boolean;
  /** Ф2: режим на сложност — определя кои табове/полета се показват. */
  complexityMode?: ComplexityMode;
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
  sku: "",
  gtin: "",
  brand: "",
  cost: "",
  seoTitle: "",
  seoDescription: "",
  sizeGuideId: "",
  madeToOrder: false,
  leadDaysMin: "",
  leadDaysMax: "",
  madeToOrderCap: "",
};

export function ProductForm({
  productId,
  initial = emptyInitial,
  categories,
  sizeGuides,
  simple = false,
  complexityMode = "full",
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
  const [madeToOrder, setMadeToOrder] = useState(initial.madeToOrder);
  const [leadDaysMin, setLeadDaysMin] = useState(initial.leadDaysMin);
  const [leadDaysMax, setLeadDaysMax] = useState(initial.leadDaysMax);
  const [madeToOrderCap, setMadeToOrderCap] = useState(initial.madeToOrderCap);
  const [netQuantityValue, setNetQuantityValue] = useState(initial.netQuantityValue);
  const [netQuantityUnit, setNetQuantityUnit] = useState(initial.netQuantityUnit);
  const [sku, setSku] = useState(initial.sku);
  const [gtin, setGtin] = useState(initial.gtin);
  const [brand, setBrand] = useState(initial.brand);
  const [cost, setCost] = useState(initial.cost);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [sizeGuideId, setSizeGuideId] = useState(initial.sizeGuideId);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /* Ф2: продуктовите полета следват режима на сложност. simple (onboarding) =
     най-прост изглед. Иначе по режима: hobby=3 карти без табове; business=main+
     logistics; full=всичко. */
  const effectiveMode: ComplexityMode = simple ? "hobby" : complexityMode;
  const showLogistics = isVisible(1, effectiveMode); // Характеристики, Тегло/размер
  const showAdvanced = isVisible(2, effectiveMode); // Кодове, SEO, Варианти, Промоция, Size guide
  const showTabs = showLogistics; // business+ → табове; hobby → колона

  /* Dirty-guard само за редакция (при създаване всичко е ново → бутонът е активен). */
  const current = {
    name, description, categoryId, price, promoPrice, stock, active, images,
    attributes, axes, variants, deal, weight, length, width, height,
    netQuantityValue, netQuantityUnit, sku, gtin, brand, cost, seoTitle,
    seoDescription, sizeGuideId, madeToOrder, leadDaysMin, leadDaysMax, madeToOrderCap,
  };
  const initialSnapshot = {
    name: initial.name, description: initial.description, categoryId: initial.categoryId,
    price: initial.price, promoPrice: initial.promoPrice, stock: initial.stock,
    active: initial.status === "active", images: initial.images, attributes: initial.attributes,
    axes: initial.options, variants: initial.variants, deal: initial.deal, weight: initial.weight,
    length: initial.length, width: initial.width, height: initial.height,
    netQuantityValue: initial.netQuantityValue, netQuantityUnit: initial.netQuantityUnit,
    sku: initial.sku, gtin: initial.gtin, brand: initial.brand, cost: initial.cost,
    seoTitle: initial.seoTitle, seoDescription: initial.seoDescription,
    sizeGuideId: initial.sizeGuideId, madeToOrder: initial.madeToOrder,
    leadDaysMin: initial.leadDaysMin, leadDaysMax: initial.leadDaysMax,
    madeToOrderCap: initial.madeToOrderCap,
  };
  const dirty = !productId || isDirty(current, initialSnapshot);

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
        sku,
        gtin,
        brand,
        cost,
        seoTitle,
        seoDescription,
        sizeGuideId,
        madeToOrder,
        leadDaysMin,
        leadDaysMax,
        madeToOrderCap,
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

  const cardBasics = (
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
  );

  const cardPricing = (
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
  );

  const cardImages = (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Снимки</h2>
      <p className="text-sm text-ink-500">До 8 снимки, първата е корицата.</p>
      <ImageUploader images={images} onChange={handleImagesChange} />
      {fieldErrors.images && <p className="text-sm text-danger-600">{fieldErrors.images}</p>}
    </Card>
  );

  const cardWeight = (
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
  );

  const cardMadeToOrder = (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink-900">Ръчна изработка</h2>
          <InfoHint
            ariaLabel="Какво е ръчна изработка"
            label="Приемай поръчки дори когато готовите бройки свършат. Купувачът вижда, че продуктът се изработва специално за него, и колко време отнема."
          />
        </span>
        <p className="text-sm text-ink-500">
          За продукти, които правиш на ръка. Когато наличността свърши, магазинът
          продължава да приема поръчки „по изработка“ — вместо да показва „изчерпано“.
        </p>
      </div>

      <Checkbox
        label="Приемай поръчки по изработка при изчерпване"
        checked={madeToOrder}
        onChange={(e) => setMadeToOrder(e.target.checked)}
      />

      {madeToOrder && (
        <div className="flex flex-col gap-4 border-t border-surface-200 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-900">Срок за изработка (дни)</span>
            <div className="flex items-end gap-3 sm:max-w-xs">
              <Input
                label="От"
                type="number"
                min={1}
                inputMode="numeric"
                value={leadDaysMin}
                onChange={(e) => setLeadDaysMin(e.target.value)}
                error={fieldErrors.leadDaysMin}
              />
              <span className="pb-3 text-ink-400">–</span>
              <Input
                label="До"
                type="number"
                min={1}
                inputMode="numeric"
                value={leadDaysMax}
                onChange={(e) => setLeadDaysMax(e.target.value)}
                error={fieldErrors.leadDaysMax}
              />
            </div>
            <p className="text-sm text-ink-500">
              Купувачът вижда „очаквайте {leadDaysMin || "10"}–{leadDaysMax || "14"} дни“.
            </p>
          </div>

          <div className="sm:max-w-xs">
            <Input
              label="Максимум поръчки в опашка (по избор)"
              type="number"
              min={1}
              inputMode="numeric"
              value={madeToOrderCap}
              onChange={(e) => setMadeToOrderCap(e.target.value)}
              error={fieldErrors.madeToOrderCap}
              hint="Празно = без ограничение. Спира приема, ако едновременните поръчки по изработка достигнат това число — за да не се презапишеш."
            />
          </div>
        </div>
      )}
    </Card>
  );

  const cardCodes = (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Продуктови кодове</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="SKU"
          hint="Твой вътрешен код (напр. BLU-M-01). Клиентът не го вижда."
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          error={fieldErrors.sku}
        />
        <Input
          label="Баркод (GTIN / EAN)"
          hint="Баркод на артикула. Подобрява рекламите в Google."
          inputMode="numeric"
          value={gtin}
          onChange={(e) => setGtin(e.target.value)}
          error={fieldErrors.gtin}
        />
        <Input
          label="Марка"
          hint="Реалната марка. Празно → името на магазина."
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          error={fieldErrors.brand}
        />
        <PriceInput
          label="Доставна цена"
          hint="Само за теб — смятаме печалба. Не се вижда публично."
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          error={fieldErrors.cost}
        />
      </div>
    </Card>
  );

  const cardSizeGuide = (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Таблица с размери</h2>
      {sizeGuides.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Таблица с размери"
              options={sizeGuides}
              placeholder="— Няма —"
              value={sizeGuideId}
              onChange={(e) => setSizeGuideId(e.target.value)}
            />
          </div>
          {sizeGuideId && (
            <Button
              type="button"
              variant="secondary"
              className="h-11 shrink-0 text-danger-600"
              onClick={() => setSizeGuideId("")}
            >
              <Icon name="x" size={16} />
              Премахни
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-control border border-dashed border-surface-300 bg-surface-50 p-4">
          <p className="text-sm text-ink-500">
            Още нямаш таблици с размери. Създай таблица (напр. „Дамски дрехи“) и я
            закачи тук — купувачите ще виждат размерите преди да поръчат.
          </p>
          <div>
            <LinkButton href="/dashboard/size-guides" variant="secondary" size="sm">
              <Icon name="plus" size={16} />
              Създай таблица
            </LinkButton>
          </div>
        </div>
      )}
    </Card>
  );

  const cardSeo = (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">SEO</h2>
      <Input
        label="SEO заглавие"
        hint="Празно → името на продукта. Показва се в таба на браузъра и Google."
        maxLength={60}
        value={seoTitle}
        onChange={(e) => setSeoTitle(e.target.value)}
        error={fieldErrors.seoTitle}
      />
      <div className="flex flex-col gap-1">
        <Textarea
          label="SEO описание"
          hint="Празно → началото на описанието. Показва се в Google под заглавието."
          maxLength={160}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          error={fieldErrors.seoDescription}
        />
        <p className="self-end text-xs text-ink-500">{seoDescription.length}/160</p>
      </div>
    </Card>
  );

  const cardDeal = (
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
  );

  const cardAttributes = (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">Характеристики</h2>
      <AttributesEditor attributes={attributes} onChange={setAttributes} />
    </Card>
  );

  const cardVariants = (
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
  );

  /* Кой таб съдържа поле с грешка → marker точка. Табовете codes/variants
     съществуват само при showAdvanced → трябва да съвпадат с панелите по-долу. */
  const fe = fieldErrors;
  const productTabs: TabItem[] = [
    {
      key: "main",
      label: "Основно",
      marker: !!(
        fe.name ||
        fe.categoryId ||
        fe.description ||
        fe.price ||
        fe.promoPrice ||
        fe.stock ||
        fe.images
      ),
    },
    { key: "logistics", label: "Логистика", marker: !!(fe.weight || fe.length || fe.width || fe.height) },
    ...(showAdvanced
      ? ([
          {
            key: "codes",
            label: "Кодове и SEO",
            marker: !!(fe.sku || fe.gtin || fe.brand || fe.cost || fe.seoTitle || fe.seoDescription),
          },
          { key: "variants", label: "Варианти", marker: !!fe.deal },
        ] as TabItem[])
      : []),
  ];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      noValidate
    >
      {!showTabs ? (
        <>
          {cardBasics}
          {cardPricing}
          {cardImages}
        </>
      ) : (
        <Tabs ariaLabel="Продукт" tabs={productTabs}>
          <TabPanel tabKey="main">
            <div className="flex flex-col gap-4">
              {cardBasics}
              {cardPricing}
              {cardImages}
              {cardAttributes}
            </div>
          </TabPanel>
          <TabPanel tabKey="logistics">
            <div className="flex flex-col gap-4">
              {cardWeight}
              {cardMadeToOrder}
              {showAdvanced && cardSizeGuide}
            </div>
          </TabPanel>
          {showAdvanced && (
            <TabPanel tabKey="codes">
              <div className="flex flex-col gap-4">
                {cardCodes}
                {cardSeo}
              </div>
            </TabPanel>
          )}
          {showAdvanced && (
            <TabPanel tabKey="variants">
              <div className="flex flex-col gap-4">
                {cardVariants}
                {cardDeal}
              </div>
            </TabPanel>
          )}
        </Tabs>
      )}

      {/* Футерът е отделна карта с горен отстъп — не се слива с последната
          секция (feedback от 2026-07-04, снимка от мобилно). */}
      <div className="mt-2 flex items-center gap-3 rounded-card border border-surface-200 bg-surface-0 p-4">
        <Button type="submit" loading={saving} disabled={!dirty}>
          {productId ? "Запази промените" : "Създай продукта"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push(redirectTo)}>
          Отказ
        </Button>
      </div>
    </form>
  );
}
