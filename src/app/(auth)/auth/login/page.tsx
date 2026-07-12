import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/actions/auth";

export const metadata = { title: "Вход — Frizmo Shops" };

interface PageProps {
  searchParams: Promise<{ error?: string; role?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, role, next } = await searchParams;
  const oauthError =
    error === "oauth" ? "Входът с Google не бе успешен. Опитай пак." : undefined;
  const safeRole = role === "buyer" ? "buyer" : role === "seller" ? "seller" : undefined;
  return (
    <AuthForm mode="login" action={signIn} role={safeRole} next={next} oauthError={oauthError} />
  );
}
