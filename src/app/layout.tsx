import type { Metadata, Viewport } from "next";
import { Inter, Lora, Onest, Oswald, Playfair_Display, Sofia_Sans, Sofia_Sans_Condensed, Space_Grotesk } from "next/font/google";
import { PwaSplash } from "@/components/pwa-splash";
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
/* Storefront-темовите шрифтове: preload:false → браузърът НЕ ги тегли в
   critical path на всяка страница (landing/каталог/dashboard ги нямат). @font-face
   се генерира, но woff2 се дърпа чак когато темата реално приложи шрифта на
   storefront. Спестява ~5 излишни font заявки извън магазините. */
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", preload: false });
const lora = Lora({ subsets: ["latin", "cyrillic"], variable: "--font-lora", preload: false });
/* Display сериф за темата „Оникс" (premium, висок контраст) */
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], variable: "--font-playfair", preload: false });
/* Кондензиран за темите „Основа"/„Гранит" (индустриални) */
const oswald = Oswald({ subsets: ["latin", "cyrillic"], variable: "--font-condensed", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://frizmo-shops.vercel.app"),
  title: "Frizmo Shops",
  description: "Твоят онлайн магазин. Готов днес. Без програмист.",
  applicationName: "Frizmo Shops",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Frizmo Shops",
    /* Native iOS splash преди React да зареди — крие белия flash при старт на
       PWA-то. Един кадър (маскотът в работилницата) в тон с in-app splash-а. */
    startupImage: "/splash-bee-poster.jpg",
  },
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
      className={`${sofiaSans.variable} ${onest.variable} ${sofiaSansCondensed.variable} ${inter.variable} ${spaceGrotesk.variable} ${lora.variable} ${playfair.variable} ${oswald.variable} h-full antialiased`}
      /* data-theme се слага от anti-FOUC скрипта преди хидратацията */
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: браузър разширения (ColorZilla и др.) слагат
          атрибути като cz-shortcut-listen на body-то преди хидратацията →
          безобиден mismatch, който заглушаваме само на този елемент. */}
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {/* Anti-FOUC: dark темата е САМО за dashboard/admin (търговски панел).
            Публичните страници (landing, каталог, магазини) са винаги светли —
            лицето на бранда не зависи от лична настройка (решение 2026-07-03). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=location.pathname;if((p.indexOf('/dashboard')===0||p.indexOf('/admin')===0)&&localStorage.getItem('frizmo-theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}})()",
          }}
        />
        {/* Инстант splash-shell: при standalone PWA рисува крем екран ВЕДНАГА
            (преди React), за да не мигне landing-ът. React PwaSplash поема отгоре
            и маха shell-а (#pwa-splash-shell) щом монтира видеото. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=(window.navigator.standalone===true)||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);if(!s)return;var d=document.createElement('div');d.id='pwa-splash-shell';d.style.cssText='position:fixed;inset:0;z-index:99;background:#faf8f5';document.documentElement.appendChild(d)}catch(e){}})()",
          }}
        />
        <PwaSplash />
        {children}
        <Toaster />
        <CookieConsent />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
