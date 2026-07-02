import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db, products, shops } from "@/db";
import { getAllPosts } from "@/lib/blog";

const BASE = "https://frizmo-shops.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/shops`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const posts = getAllPosts().map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.6,
  }));

  const publishedShops = await db.query.shops.findMany({
    where: eq(shops.status, "published"),
    columns: { id: true, slug: true, updatedAt: true },
  });

  const shopPages = publishedShops.flatMap((shop) => [
    { url: `${BASE}/s/${shop.slug}`, lastModified: shop.updatedAt, priority: 0.8 },
    { url: `${BASE}/s/${shop.slug}/products`, lastModified: shop.updatedAt, priority: 0.7 },
    { url: `${BASE}/s/${shop.slug}/about`, priority: 0.5 },
  ]);

  const productPages: MetadataRoute.Sitemap = [];
  for (const shop of publishedShops) {
    const activeProducts = await db.query.products.findMany({
      where: and(eq(products.shopId, shop.id), eq(products.status, "active")),
      columns: { slug: true, updatedAt: true },
    });
    for (const product of activeProducts) {
      productPages.push({
        url: `${BASE}/s/${shop.slug}/p/${product.slug}`,
        lastModified: product.updatedAt,
        priority: 0.6,
      });
    }
  }

  return [...staticPages, ...posts, ...shopPages, ...productPages];
}
