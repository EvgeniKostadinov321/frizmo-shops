import { AccountNav } from "@/components/account/account-nav";
import { requireBuyer } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireBuyer();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <AccountNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
