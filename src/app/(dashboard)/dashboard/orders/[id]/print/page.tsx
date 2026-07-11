import { notFound } from "next/navigation";
import { z } from "zod";
import { PrintButton } from "@/components/dashboard/print-button";
import { getOrderWithItems } from "@/db/queries/orders";
import { requireShop } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Складова бележка — Frizmo Shops" };

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" });

/**
 * Печатна складова бележка (packing slip) за търговеца. Черно на бяло — нарочно
 * извън dashboard тъмната тема (печат-friendly). При печат `@media print` крие
 * всичко освен `.print-slip` (sidebar/nav от dashboard layout-а не излизат).
 */
export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await requireShop();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getOrderWithItems(id);
  if (!order || order.shopId !== shop.id) notFound();

  const number = `№${String(order.orderNumber).padStart(4, "0")}`;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger — статичен print stylesheet, без потребителски вход */}
      <style>{
        "@media print{body *{visibility:hidden}.print-slip,.print-slip *{visibility:visible}.print-slip{position:absolute;inset:0}.print-hide{display:none}}"
      }</style>

      <div className="print-slip mx-auto max-w-2xl bg-white p-8 text-black">
        <div className="print-hide mb-6 flex justify-end">
          <PrintButton />
        </div>

        <header className="mb-6 border-b border-black/20 pb-4">
          <p className="text-sm text-black/60">{shop.name}</p>
          <h1 className="font-display text-2xl font-extrabold">Складова бележка {number}</h1>
          <p className="text-sm text-black/60">{dateFormat.format(order.createdAt)}</p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <h2 className="mb-1 font-bold">Клиент</h2>
            <p>{order.customerName}</p>
            <p>{order.customerPhone}</p>
            {(order.address || order.city) && (
              <p>{[order.address, order.city].filter(Boolean).join(", ")}</p>
            )}
          </div>
          <div>
            <h2 className="mb-1 font-bold">Доставка</h2>
            <p>{order.shippingName}</p>
            <p>{order.paymentName}</p>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/40 text-left">
              <th className="py-1">Артикул</th>
              <th className="py-1 text-center">Бр.</th>
              <th className="py-1 text-right">Сума</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-black/10">
                <td className="py-1.5">
                  {item.productName}
                  {item.variantLabel && ` (${item.variantLabel})`}
                </td>
                <td className="py-1.5 text-center tabular-nums">{item.quantity}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatPrice(item.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <p>Доставка: {formatPrice(order.shippingPriceCents)}</p>
          <p className="text-lg font-bold">Общо: {formatPrice(order.totalCents)}</p>
        </div>

        {order.note && (
          <p className="mt-4 rounded border border-black/20 p-3 text-sm">Бележка: {order.note}</p>
        )}
      </div>
    </>
  );
}
