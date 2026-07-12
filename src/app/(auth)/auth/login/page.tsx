import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/actions/auth";

export const metadata = { title: "Вход — Frizmo Shops" };

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const oauthError =
    error === "oauth" ? "Входът с Google не бе успешен. Опитай пак." : undefined;
  return <AuthForm mode="login" action={signIn} oauthError={oauthError} />;
}
