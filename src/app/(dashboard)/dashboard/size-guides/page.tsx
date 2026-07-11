import { SizeGuidesManager } from "@/components/dashboard/size-guides-manager";
import { getSizeGuides } from "@/db/queries/size-guides";
import { requireShop } from "@/lib/auth";

export const metadata = { title: "Таблици с размери — Frizmo Shops" };

export default async function SizeGuidesPage() {
  const { shop } = await requireShop();
  const guides = await getSizeGuides(shop.id);
  return <SizeGuidesManager guides={guides} />;
}
