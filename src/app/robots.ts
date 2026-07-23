import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/auth", "/api"],
    },
    /* Sitemap ТРЯБВА да е на СЪЩИЯ хост (одит #4 SEO-01) — cross-host декларация се игнорира
       от Google. Минава през siteUrl() като sitemap.ts, иначе след смяна на домейна sitemap-ът
       на прод сочи стария vercel.app и целият каталог рискува да не се индексира. */
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
