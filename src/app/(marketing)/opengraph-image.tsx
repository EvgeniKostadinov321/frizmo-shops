import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Landing OG image. ImageResponse рендерира извън браузъра (Satori) —
 * не чете CSS custom properties, затова hex стойностите тук са копие на
 * --color-brand-surface/--color-brand-surface-deep/--color-brand-surface-ink
 * от tokens.css (R1.1). При промяна на тези токени — обнови и тук.
 */
export default function LandingOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #33241a 0%, #241811 100%)",
          color: "#faf8f5",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Frizmo Shops
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.1,
          }}
        >
          <div>Твоят онлайн магазин.</div>
          <div>Готов днес.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
