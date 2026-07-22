import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <form action={signOut.bind(null, "/auth/login")}>
      <Button variant="ghost" size="sm" type="submit">
        Изход
      </Button>
    </form>
  );
}
