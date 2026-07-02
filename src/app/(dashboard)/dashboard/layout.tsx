import Link from "next/link";
import { ensureProfile, requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Toaster } from "@/components/dashboard/toaster";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await ensureProfile(user.id);

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-surface-0 px-4 md:px-6">
        <Link href="/dashboard" className="text-lg font-bold text-brand-600">
          Frizmo Shops
        </Link>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-5xl p-4 md:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
