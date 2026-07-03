interface BeeMedallionProps {
  /** Размерът на медальона (клас за ширина/височина), напр. "size-44". */
  className?: string;
}

/**
 * Маскотът-видео в кръгъл медальон. Видеото има светъл крем фон (видео моделите
 * не поддържат прозрачност) — кръглата маска + фон в тон крият ръбовете. Видеото
 * е предварително направено безшовно (crossfade на края с началото), затова
 * ползваме прост нативен `loop`. Постерът показва статичен кадър при reduced-
 * motion / докато видеото зареди.
 */
export function BeeMedallion({ className = "size-44" }: BeeMedallionProps) {
  return (
    <div className={`relative ${className} overflow-hidden rounded-full bg-surface-100 shadow-card`}>
      {/* Мек brand glow вътре в кръга — топлина, дълбочина */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgb(154_87_23/0.10),transparent_70%)]"
      />
      <video
        className="absolute inset-0 h-full w-full rounded-full object-cover object-[center_20%]"
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
        poster="/bee-wave.png"
        aria-hidden
      >
        <source src="/bee-wave.webm" type="video/webm" />
        <source src="/bee-wave.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
