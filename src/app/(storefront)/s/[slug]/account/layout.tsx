import { redirect } from "next/navigation";

/** S3-глобален: профилът се премести на платформено ниво (/account). Пренасочваме
    всички вложени пътища (layout-ът се изпълнява преди страниците). */
export default function StorefrontAccountRedirect() {
  redirect("/account");
}
