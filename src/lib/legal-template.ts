import type { Shop } from "@/db";

/** Стабилни id-та на правните секции — ключове за legalOverrides. */
export const LEGAL_SECTION_IDS = [
  "general",
  "payment",
  "delivery",
  "returns",
  "privacy",
] as const;

export type LegalSectionId = (typeof LEGAL_SECTION_IDS)[number];

export interface LegalSection {
  id: LegalSectionId;
  title: string;
  paragraphs: string[];
}

/** Човешките заглавия на секциите — ползват се и в редактора. */
export const LEGAL_SECTION_TITLES: Record<LegalSectionId, string> = {
  general: "Общи условия",
  payment: "Поръчка и плащане",
  delivery: "Доставка",
  returns: "Право на отказ и връщане",
  privacy: "Лични данни",
};

/**
 * Шаблонните условия за магазин — параметризирани с данните на търговеца.
 * Покриват базовите ЗЗП изисквания (доставка, връщане в 14 дни, лични данни).
 * Юридически неутрален текст; отговорността за съдържанието е на търговеца.
 */
export function legalTemplate(shop: Shop): Record<LegalSectionId, string[]> {
  const contact = [shop.email, shop.phone].filter(Boolean).join(" / ") || "контактите на магазина";

  return {
    general: [
      `Настоящите условия уреждат отношенията между ${shop.name} („Търговецът") и клиентите на онлайн магазина. С извършването на поръчка клиентът приема тези условия.`,
      `За връзка с Търговеца: ${contact}.`,
    ],
    payment: [
      "Поръчката се счита за приета след потвърждение от страна на Търговеца. Обявените цени са крайни, в евро (EUR).",
      "Приеманите методи на плащане са посочени при завършване на поръчката.",
    ],
    delivery: [
      "Сроковете и условията за доставка се посочват при завършване на поръчката. Търговецът се свързва с клиента при забавяне или невъзможност за изпълнение.",
    ],
    returns: [
      "Съгласно Закона за защита на потребителите клиентът има право да се откаже от договора в срок от 14 дни от получаване на стоката, без да посочва причина, освен за стоки, изключени от това право (напр. бързоразвалящи се храни, стоки, изработени по поръчка).",
      `За упражняване на правото на отказ клиентът уведомява Търговеца на ${contact}. Върнатата стока трябва да е в оригинален вид. Разходите за връщане са за сметка на клиента, освен ако не е уговорено друго.`,
    ],
    privacy: [
      "Личните данни на клиентите (имена, телефон, адрес, имейл) се използват единствено за изпълнение на поръчката и не се предоставят на трети лица, освен на куриерски фирми за целите на доставката.",
      "Клиентът може да поиска справка, корекция или изтриване на данните си, като се свърже с Търговеца.",
    ],
  };
}

/**
 * Финалните правни секции: за всяка взима override-а (ако търговецът е писал),
 * иначе шаблонния текст. Override се разбива на параграфи по празен ред.
 */
export function legalSections(
  shop: Shop,
  overrides: Record<string, string> = {},
): LegalSection[] {
  const template = legalTemplate(shop);
  return LEGAL_SECTION_IDS.map((id) => {
    const override = (overrides[id] ?? "").trim();
    const paragraphs = override
      ? override
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
      : template[id];
    return { id, title: LEGAL_SECTION_TITLES[id], paragraphs };
  });
}
