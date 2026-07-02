import { notFound } from "next/navigation";
import { ProductForm } from "@/components/dashboard/product-form";
import { getCategoriesTree } from "@/db/queries/categories";
import { getProductWithRelations } from "@/db/queries/products";
import { requireShop } from "@/lib/auth";
import { centsToInput } from "@/lib/money";

export const metadata = { title: "Редакция на продукт — Frizmo Shops" };

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { shop } = await requireShop();
  const { id } = await params;

  const product = await getProductWithRelations(id);
  if (!product || product.shopId !== shop.id) notFound();

  const tree = await getCategoriesTree(shop.id);
  const categoryOptions = tree.flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((c) => ({ value: c.id, label: `${root.name} → ${c.name}` })),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink-900">Редакция: {product.name}</h1>
      <ProductForm
        productId={product.id}
        categories={categoryOptions}
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
        }}
      />
    </div>
  );
}
