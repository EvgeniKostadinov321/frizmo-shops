import { ForceLightTheme } from "@/components/marketing/force-light-theme";

/**
 * Auth оформление: публично → само светла тема (ForceLightTheme маха останал
 * dark от dashboard навигация). Самата split композиция (форма + брандов панел
 * с маскота) живее в AuthForm, за да може един state да контролира реакцията на
 * маскота при фокус в паролата.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceLightTheme />
      {children}
    </>
  );
}
