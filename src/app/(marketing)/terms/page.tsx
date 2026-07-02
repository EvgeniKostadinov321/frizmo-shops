import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { PLATFORM_TERMS } from "@/lib/platform-legal";

export const metadata: Metadata = {
  title: "Условия за ползване — Frizmo Shops",
  robots: { index: false },
};

export default function TermsPage() {
  return <LegalPage title="Условия за ползване" sections={PLATFORM_TERMS} />;
}
