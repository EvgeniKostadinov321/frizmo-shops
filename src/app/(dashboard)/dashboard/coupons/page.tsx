import { CouponsManager } from "@/components/dashboard/coupons-manager";
import { getShopCoupons } from "@/db/queries/coupons";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Промо кодове — Frizmo Shops" };

export default async function CouponsPage() {
  const { shop } = await requireShop();
  const coupons = await getShopCoupons(shop.id);
  return <CouponsManager coupons={coupons} />;
}
