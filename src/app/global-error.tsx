"use client";

import { useEffect } from "react";

/**
 * Последна защита: хваща грешки в самия root layout (напр. паднала DB заявка в
 * layout-а). Замества цялото дърво, затова носи собствени <html>/<body> и inline
 * стилове — не може да разчита на app CSS, който може да не се е заредил.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error:", error);
  }, [error]);

  return (
    <html lang="bg">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "16px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#211d18",
          background: "#f6f3ee",
        }}
      >
        <h1 style={{ fontSize: "26px", fontWeight: 700, margin: 0 }}>Нещо се обърка</h1>
        <p style={{ maxWidth: "34rem", color: "#5c554b", margin: 0 }}>
          Възникна неочаквана грешка. Опитай да презаредиш страницата.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "4px",
            height: "44px",
            padding: "0 20px",
            borderRadius: "10px",
            border: "none",
            background: "#211d18",
            color: "#fff",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Опитай пак
        </button>
      </body>
    </html>
  );
}
