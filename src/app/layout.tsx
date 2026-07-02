import type { Metadata, Viewport } from "next";
import { Inter, Lora, Space_Grotesk } from "next/font/google";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { BRAND_THEME_COLOR } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
/* Шрифтовете на storefront темите (modern / warm) — виж THEME_PRESETS */
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const lora = Lora({ subsets: ["latin", "cyrillic"], variable: "--font-lora" });

export const metadata: Metadata = {
  metadataBase: new URL("https://frizmo-shops.vercel.app"),
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
    <html
      lang="bg"
      className={`${inter.variable} ${spaceGrotesk.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Anti-FOUC: прилага dark темата преди първото рисуване (ADR dark-mode) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('frizmo-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.dataset.theme='dark'}}catch(e){}})()",
          }}
        />
        {children}
        <Toaster />
        <CookieConsent />
      </body>
    </html>
  );
}
