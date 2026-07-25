/**
 * Шевица hairline — геометричен мотив по българска бродерия (ромбове с
 * кръстчета), рисуван като повтарящ се SVG pattern в currentColor.
 * ПОДПИСЕН детайл — ползва се пестеливо (hero + финален CTA), никъде другаде.
 * `id` трябва да е уникално per инстанция — SVG pattern референциите са
 * глобални за документа и втора инстанция иначе взима цвета на първата.
 */
export function ShevitsaDivider({ id, className = "" }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden
      className={`h-2.5 w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={id} width="28" height="10" patternUnits="userSpaceOnUse">
          {/* Ромб */}
          <path
            d="M7 1 L13 5 L7 9 L1 5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          {/* Кръстче между ромбовете */}
          <path
            d="M19 3 L23 7 M23 3 L19 7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
