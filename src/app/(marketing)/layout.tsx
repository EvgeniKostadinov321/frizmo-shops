import { ForceLightTheme } from "@/components/marketing/force-light-theme";
import { MotionProvider } from "@/components/marketing/motion-provider";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <MotionProvider>
      <ForceLightTheme />
      <div className="flex min-h-screen flex-col">
        <SiteHeader loggedIn={Boolean(user)} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
