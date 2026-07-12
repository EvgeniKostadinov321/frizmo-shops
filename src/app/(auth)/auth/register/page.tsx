import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/actions/auth";

export const metadata = { title: "Регистрация — Frizmo Shops" };

interface PageProps {
  searchParams: Promise<{ role?: string; next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { role, next } = await searchParams;
  const safeRole = role === "buyer" ? "buyer" : role === "seller" ? "seller" : undefined;
  return <AuthForm mode="register" action={signUp} role={safeRole} next={next} />;
}
