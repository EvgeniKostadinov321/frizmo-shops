"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { AuthFormState } from "@/actions/auth";

interface AuthFormProps {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isRegister = mode === "register";

  return (
    <Card className="w-full max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">
        {isRegister ? "Създай профил" : "Вход"}
      </h1>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {isRegister && (
          <Input
            label="Име и фамилия"
            name="fullName"
            autoComplete="name"
            error={state.fieldErrors?.fullName}
          />
        )}
        <Input
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          error={state.fieldErrors?.email}
        />
        <Input
          label="Парола"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          error={state.fieldErrors?.password}
        />
        {state.error && <p className="text-sm text-danger-600">{state.error}</p>}
        <Button type="submit" loading={pending}>
          {isRegister ? "Регистрирай се" : "Влез"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-500">
        {isRegister ? (
          <>
            Имаш профил?{" "}
            <Link className="text-brand-600 hover:underline" href="/auth/login">
              Влез
            </Link>
          </>
        ) : (
          <>
            Нямаш профил?{" "}
            <Link className="text-brand-600 hover:underline" href="/auth/register">
              Регистрирай се
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}
