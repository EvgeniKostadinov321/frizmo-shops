import { beforeEach, describe, expect, it, vi } from "vitest";

/* Хойстнати mock-ове: Supabase auth + DB insert + rate-limit + redirect.
   Целим да проверим САМО потока на потвърждение по имейл (нашата логика),
   без реална мрежа/база. */
const {
  signUpMock,
  signInMock,
  resendMock,
  redirectMock,
  checkRateLimitMock,
  insertMock,
} = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInMock: vi.fn(),
  resendMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    /* next/navigation redirect() хвърля специален сигнал — имитираме го, за да
       различим „пренасочи" от „върни state". */
    throw new Error(`REDIRECT:${path}`);
  }),
  checkRateLimitMock: vi.fn().mockResolvedValue(true),
  insertMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["host", "www.frizmoshops.bg"]])),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/sanitize", () => ({ sanitizeText: (s: string) => s }));
vi.mock("@/lib/auth-redirect", () => ({ resolvePostAuthPath: () => "/dashboard" }));
vi.mock("@/lib/safe-redirect", () => ({ safeNextPath: (n?: string) => n ?? "/" }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn().mockResolvedValue({
    auth: { signUp: signUpMock, signInWithPassword: signInMock, resend: resendMock },
  }),
}));
vi.mock("@/db", () => ({
  db: { insert: () => ({ values: () => ({ onConflictDoNothing: insertMock }) }) },
  profiles: {},
  shops: {},
}));

import { resendConfirmation, signIn, signUp } from "./auth";

/** Строи FormData за регистрация/вход. */
function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue(true);
  insertMock.mockResolvedValue(undefined);
});

describe("signUp — потвърждение по имейл", () => {
  it("връща needsConfirmation когато няма сесия (потвърждението е включено)", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    const state = await signUp(
      {},
      form({
        fullName: "Иван Петров",
        email: "ivan@gmail.com",
        password: "parola1234",
        acceptTerms: "on",
        role: "seller",
      }),
    );
    expect(state.needsConfirmation).toBe(true);
    expect(state.email).toBe("ivan@gmail.com");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("пренасочва (без needsConfirmation) когато сесия има веднага", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "x" } },
      error: null,
    });
    await expect(
      signUp(
        {},
        form({
          fullName: "Иван Петров",
          email: "ivan@gmail.com",
          password: "parola1234",
          acceptTerms: "on",
          role: "seller",
        }),
      ),
    ).rejects.toThrow(/REDIRECT:/);
    expect(redirectMock).toHaveBeenCalled();
  });

  it("записва профила със съгласие дори при чакащо потвърждение", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    await signUp(
      {},
      form({
        fullName: "Иван Петров",
        email: "ivan@gmail.com",
        password: "parola1234",
        acceptTerms: "on",
        role: "seller",
      }),
    );
    /* Профилът трябва да е записан (за да е налице съгласието), макар входът да чака. */
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

describe("signIn — неразпознат vs непотвърден имейл", () => {
  it("непотвърден имейл (по code) → needsConfirmation, НЕ „грешна парола“", async () => {
    signInMock.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    const state = await signIn({}, form({ email: "ivan@gmail.com", password: "parola1234" }));
    expect(state.needsConfirmation).toBe(true);
    expect(state.email).toBe("ivan@gmail.com");
    expect(state.error).not.toBe("Грешен имейл или парола.");
  });

  it("непотвърден имейл (само по съобщение, стара версия) → needsConfirmation", async () => {
    signInMock.mockResolvedValue({ error: { message: "Email not confirmed" } });
    const state = await signIn({}, form({ email: "ivan@gmail.com", password: "parola1234" }));
    expect(state.needsConfirmation).toBe(true);
  });

  it("истинска грешна парола → общо съобщение, БЕЗ needsConfirmation", async () => {
    signInMock.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    const state = await signIn({}, form({ email: "ivan@gmail.com", password: "wrongpass1" }));
    expect(state.needsConfirmation).toBeFalsy();
    expect(state.error).toBe("Грешен имейл или парола.");
  });
});

describe("resendConfirmation", () => {
  it("изпраща наново и връща resent=true", async () => {
    resendMock.mockResolvedValue({ error: null });
    const state = await resendConfirmation({}, form({ email: "ivan@gmail.com" }));
    expect(resendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "ivan@gmail.com" }),
    );
    expect(state.resent).toBe(true);
    expect(state.needsConfirmation).toBe(true);
  });

  it("неутрален успех дори при грешка от Supabase (anti-enumeration)", async () => {
    resendMock.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
    const state = await resendConfirmation({}, form({ email: "ivan@gmail.com" }));
    /* Не издаваме дали акаунтът съществува/грешката — връщаме resent. */
    expect(state.resent).toBe(true);
  });

  it("блокира при надвишен rate-limit", async () => {
    checkRateLimitMock.mockResolvedValue(false);
    const state = await resendConfirmation({}, form({ email: "ivan@gmail.com" }));
    expect(resendMock).not.toHaveBeenCalled();
    expect(state.error).toMatch(/Твърде много/);
    expect(state.needsConfirmation).toBe(true);
  });

  it("отхвърля невалиден имейл", async () => {
    const state = await resendConfirmation({}, form({ email: "не-имейл" }));
    expect(resendMock).not.toHaveBeenCalled();
    expect(state.error).toMatch(/Невалиден/);
  });
});
