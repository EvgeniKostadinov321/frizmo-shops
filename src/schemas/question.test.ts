import { describe, expect, it } from "vitest";
import { answerQuestionSchema, submitQuestionSchema } from "./question";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("submitQuestionSchema", () => {
  it("приема валиден въпрос", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "Има ли гаранция?" });
    expect(r.success).toBe(true);
  });
  it("отхвърля кратък въпрос", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "а?" });
    expect(r.success).toBe(false);
  });
  it("askerName е опционален (default празно)", () => {
    const r = submitQuestionSchema.safeParse({ productId: uuid, question: "Достатъчно дълъг въпрос?" });
    expect(r.success && r.data.askerName).toBe("");
  });
});

describe("answerQuestionSchema", () => {
  it("отхвърля празен отговор", () => {
    const r = answerQuestionSchema.safeParse({ id: uuid, answer: "" });
    expect(r.success).toBe(false);
  });
  it("приема валиден отговор", () => {
    const r = answerQuestionSchema.safeParse({ id: uuid, answer: "Да, 24 месеца." });
    expect(r.success).toBe(true);
  });
});
