import { notFound } from "next/navigation";
import { ProductForm } from "@/components/dashboard/product-form";
import { getCategoriesTree } from "@/db/queries/categories";
import { getProductWithRelations } from "@/db/queries/products";
import { getSizeGuides } from "@/db/queries/size-guides";
import { requireShop } from "@/lib/auth";
import { flattenCategoryOptions } from "@/lib/category-tree";
import { centsToInput, scaledToInput } from "@/lib/money";

export const metadata = { title: "Редакция на продукт — Frizmo Shops" };

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { shop } = await requireShop();
  const { id } = await params;

  const product = await getProductWithRelations(id);
  if (!product || product.shopId !== shop.id) notFound();

  const [tree, guides] = await Promise.all([
    getCategoriesTree(shop.id),
    getSizeGuides(shop.id),
  ]);
  const categoryOptions = flattenCategoryOptions(tree);
  const sizeGuideOptions = guides.map((g) => ({ value: g.id, label: g.name }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Редакция: {product.name}</h1>
      <ProductForm
        productId={product.id}
        complexityMode={shop.complexityMode}
        categories={categoryOptions}
        sizeGuides={sizeGuideOptions}
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId ?? "",
          price: centsToInput(product.priceCents),
          promoPrice: centsToInput(product.promoPriceCents),
          stock: product.stock === null ? "" : String(product.stock),
          status: product.status,
          images: product.images,
          attributes: product.attributes.map((a) => ({ name: a.name, value: a.value })),
          options: product.options.map((o) => ({ name: o.name, values: o.values })),
          variants: product.variants.map((v) => ({
            options: v.options,
            price: centsToInput(v.priceCents),
            stock: v.stock === null ? "" : String(v.stock),
            sku: v.sku ?? "",
            imagePaths: v.imagePaths,
          })),
          deal: product.promotion
            ? {
                quantity: String(product.promotion.quantity),
                totalPrice: centsToInput(product.promotion.totalPriceCents),
              }
            : null,
          weight: product.weightGrams !== null ? String(product.weightGrams) : "",
          length: product.lengthMm !== null ? scaledToInput(product.lengthMm, 10) : "",
          width: product.widthMm !== null ? scaledToInput(product.widthMm, 10) : "",
          height: product.heightMm !== null ? scaledToInput(product.heightMm, 10) : "",
          netQuantityValue:
            product.netQuantityValue !== null ? scaledToInput(product.netQuantityValue, 1000) : "",
          netQuantityUnit: product.netQuantityUnit ?? "g",
          sku: product.sku ?? "",
          gtin: product.gtin ?? "",
          brand: product.brand ?? "",
          cost: centsToInput(product.costCents),
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          sizeGuideId: product.sizeGuideId ?? "",
        }}
      />
    </div>
  );
}
