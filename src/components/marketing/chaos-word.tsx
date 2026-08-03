"use client";

import { m } from "motion/react";

/*
 * Думата „хаос" в hero H1 разиграва обещанието на продукта: буквите се
 * появяват разбъркани (разместени + завъртени) и с пружинка се подреждат
 * на място — от хаос към ред. Отместванията са ФИКСИРАНИ стойности
 * (без Math.random — SSR/hydration определеност).
 * Reduced-motion: MotionConfig изключва transform анимациите централно →
 * буквите само избледняват на място.
 */
const LETTERS = [
  { ch: "х", x: -16, y: -20, rotate: -16 },
  { ch: "а", x: 12, y: 16, rotate: 11 },
  { ch: "о", x: -8, y: 22, rotate: -9 },
  { ch: "с", x: 18, y: -14, rotate: 15 },
];

export function ChaosWord() {
  return (
    /* Буквите СА текстът (без sr-only дублаж — той правеше „хаосхаос" при
       текстово извличане: Google, копиране, четци). Всяка е inline-block, така
       че думата се чете нормално като „хаос". */
    <span className="whitespace-nowrap">
      {LETTERS.map((letter, i) => (
        <m.span
          key={letter.ch}
          initial={{ opacity: 0, x: letter.x, y: letter.y, rotate: letter.rotate }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          transition={{
            delay: 0.35 + i * 0.09,
            type: "spring",
            stiffness: 240,
            damping: 16,
          }}
          className="inline-block"
        >
          {letter.ch}
        </m.span>
      ))}
    </span>
  );
}
