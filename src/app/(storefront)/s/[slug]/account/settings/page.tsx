import type { Metadata } from "next";
import { SettingsForm } from "@/components/storefront/account/settings-form";
import { requireBuyer } from "@/lib/auth";

export const metadata: Metadata = { title: "Настройки на профила", robots: { index: false } };

export default async function AccountSettingsPage() {
  const { profile } = await requireBuyer();
  return <SettingsForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} />;
}
