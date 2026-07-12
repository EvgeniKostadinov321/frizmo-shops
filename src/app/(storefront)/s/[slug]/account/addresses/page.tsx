import type { Metadata } from "next";
import { AddressManager } from "@/components/storefront/account/address-manager";
import { getBuyerAddresses } from "@/db/queries/buyer";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Моите адреси", robots: { index: false } };

export default async function AccountAddressesPage() {
  const { profile } = await requireBuyer();
  const addresses = await getBuyerAddresses(profile.id);
  return <AddressManager addresses={addresses} />;
}
