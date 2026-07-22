import type { NextConfig } from "next";

/* Празна env var („") НЕ се хваща от `?? fallback` (само undefined/null),
   а `new URL("")` хвърля ERR_INVALID_URL и събаря целия билд. Затова падаме
   към placeholder при всяка falsy/невалидна стойност, не само липсваща. */
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseHost = (() => {
  const fallback = "placeholder.supabase.co";
  if (!rawSupabaseUrl) return fallback;
  try {
    return new URL(rawSupabaseUrl).hostname;
  } catch {
    return fallback;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
