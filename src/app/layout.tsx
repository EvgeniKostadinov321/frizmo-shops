import type { Metadata, Viewport } from "next";
import { Inter, Lora, Onest, Sofia_Sans, Sofia_Sans_Condensed, Space_Grotesk } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { Toaster } from "@/components/ui/toaster";
import { BRAND_THEME_COLOR } from "@/lib/brand";
import "./globals.css";

/* Платформена типография: Sofia Sans — body; Onest — display заглавия (R1, замества Condensed) */
const sofiaSans = Sofia_Sans({ subsets: ["latin", "cyrillic"], variable: "--font-sofia" });
const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
  variable: "--font-onest",
});
const sofiaSansCondensed = Sofia_Sans_Condensed({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sofia-cond",
});
/* Inter остава за storefront темата classic (THEME_PRESETS) */
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
      className={`${sofiaSans.variable} ${onest.variable} ${sofiaSansCondensed.variable} ${inter.variable} ${spaceGrotesk.variable} ${lora.variable} h-full antialiased`}
      /* data-theme се слага от anti-FOUC скрипта преди хидратацията */
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Anti-FOUC: dark темата е САМО за dashboard/admin (търговски панел).
            Публичните страници (landing, каталог, магазини) са винаги светли —
            лицето на бранда не зависи от лична настройка (решение 2026-07-03). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=location.pathname;if((p.indexOf('/dashboard')===0||p.indexOf('/admin')===0)&&localStorage.getItem('frizmo-theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}})()",
          }}
        />
        {children}
        <Toaster />
        <CookieConsent />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
