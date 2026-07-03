import type { MetadataRoute } from "next";
import { BRAND_BACKGROUND_COLOR, BRAND_THEME_COLOR } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frizmo Shops",
    short_name: "Frizmo Shops",
    description: "Твоят онлайн магазин. Готов днес. Без програмист.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "bg",
    background_color: BRAND_BACKGROUND_COLOR,
    theme_color: BRAND_THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
