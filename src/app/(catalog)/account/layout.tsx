import { AccountNav } from "@/components/account/account-nav";
import { requireBuyer } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireBuyer();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:gap-8 md:py-10">
      {/* Десктоп: вертикален sidebar вляво; мобилно: хоризонтални табове отгоре. */}
      <aside className="md:w-52 md:shrink-0">
        <AccountNav />
      </aside>
      <main className="min-w-0 flex-1 md:pt-1">{children}</main>
    </div>
  );
}
