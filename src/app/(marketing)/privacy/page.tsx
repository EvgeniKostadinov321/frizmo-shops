import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { PLATFORM_PRIVACY } from "@/lib/platform-legal";

export const metadata: Metadata = {
  title: "Поверителност — Frizmo Shops",
  robots: { index: false },
};

export default function PrivacyPage() {
  return <LegalPage title="Политика за поверителност" sections={PLATFORM_PRIVACY} />;
}
