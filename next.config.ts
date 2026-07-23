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

/* Базови security headers (одит #4 SEC-HDR-01) за всички пътища. Anti-framing (dashboard/
   admin/checkout не бива да са в iframe → clickjacking), nosniff, Referrer-Policy (order/next
   токени да не изтичат към external referrers), HSTS. Пълна script-src CSP се отлага —
   layout.tsx има inline anti-FOUC скриптове, които биха искали nonce; frame-ancestors е
   безопасно да влезе веднага. */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
