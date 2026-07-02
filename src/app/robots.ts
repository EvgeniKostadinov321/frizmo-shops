import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/auth", "/api"],
    },
    sitemap: "https://frizmo-shops.vercel.app/sitemap.xml",
  };
}
