import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { BRAND_THEME_COLOR } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Frizmo Shops",
  description: "Твоят онлайн магазин. Готов днес. Без програмист.",
  applicationName: "Frizmo Shops",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Frizmo Shops" },
};

export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
        <CookieConsent />
      </body>
    </html>
  );
}
