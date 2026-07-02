import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/actions/auth";

export const metadata = { title: "Регистрация — Frizmo Shops" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={signUp} />;
}
