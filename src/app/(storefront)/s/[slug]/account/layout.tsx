import { AccountNav } from "@/components/storefront/account/account-nav";
import { requireBuyer } from "@/lib/auth";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/** Купувачки профил — изисква вход (нелогнат → redirect към login). */
export default async function AccountLayout({ children, params }: AccountLayoutProps) {
  await requireBuyer();
  const { slug } = await params;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <AccountNav base={`/s/${slug}`} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
