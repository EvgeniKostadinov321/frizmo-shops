import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/actions/auth";

export const metadata = { title: "Вход — Frizmo Shops" };

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />;
}
