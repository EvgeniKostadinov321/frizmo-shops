import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { PLATFORM_COOKIES } from "@/lib/platform-legal";

export const metadata: Metadata = {
  title: "Бисквитки — Frizmo Shops",
  robots: { index: false },
};

export default function CookiesPage() {
  return <LegalPage title="Политика за бисквитки" sections={PLATFORM_COOKIES} />;
}
