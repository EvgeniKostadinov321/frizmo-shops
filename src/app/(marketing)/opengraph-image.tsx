import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Frizmo Shops — Продавай повече. Без хаос, без комисиони.";

/**
 * Landing OG image (снимка при споделяне): топла работилница снимка +
 * тъмен scrim вляво + лого и заглавие. Снимката се чете от public/ и се
 * вгражда като data-URI (Satori не тегли по мрежа при билд).
 */
export default async function LandingOgImage() {
  const bg = await readFile(join(process.cwd(), "public", "og-bg.jpg"));
  const bgUri = `data:image/jpeg;base64,${bg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
        }}
      >
        {/* Фонова снимка — в ImageResponse (Satori) <img> е единственият вариант */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgUri}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
        {/* Тъмен scrim — по-плътен вляво за четимост на текста */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(20,17,15,0.92) 0%, rgba(20,17,15,0.75) 45%, rgba(20,17,15,0.25) 100%)",
          }}
        />
        {/* Съдържание */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px",
            color: "#faf8f5",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "#faf8f5",
                color: "#1c2420",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              F
            </div>
            Frizmo Shops
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 68,
              fontWeight: 800,
              marginTop: 28,
              lineHeight: 1.05,
              maxWidth: 720,
            }}
          >
            <div>Продавай повече.</div>
            <div>Без хаос, без комисиони.</div>
          </div>
          <div style={{ marginTop: 28, fontSize: 26, color: "#cdb8a0", maxWidth: 640 }}>
            Твоят онлайн магазин за минути — 30 дни безплатно.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
