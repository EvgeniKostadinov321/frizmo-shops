import { Logo } from "@/components/ui";
import { countPendingReviews } from "@/db/queries/reviews";
import { ensureProfile, getOwnShop } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/nav";
import { PushBanner } from "@/components/dashboard/push-banner";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, shop } = await getOwnShop();
  await ensureProfile(user.id);
  const pendingReviews = shop ? await countPendingReviews(shop.id) : 0;

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-surface-0 px-4 md:px-6">
        <Logo href="/dashboard" size={28} />
        <div className="flex items-center gap-2">
          {shop && <span className="hidden text-sm text-ink-500 sm:block">{shop.name}</span>}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {shop ? (
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
          <aside className="md:w-48 md:shrink-0">
            <DashboardNav pendingReviews={pendingReviews} />
          </aside>
          <main className="min-w-0 flex-1">
            <PushBanner />
            {children}
          </main>
        </div>
      ) : (
        <main className="mx-auto max-w-5xl p-4 md:p-6">{children}</main>
      )}
    </div>
  );
}
