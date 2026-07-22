import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/auth/login" || path === "/auth/register")) {
    const sp = request.nextUrl.searchParams;
    /* Има явно намерение (роля или произход) → ПУСНИ формата да реши. Тя носи
       role+next към action-а, а resolvePostAuthPath прилага правилото „контекстът
       определя ролята". Proxy не бива да отменя това (иначе dual-role купувач,
       отворил /auth/login?role=buyer&next=/account, попада в /dashboard). */
    if (sp.has("role") || sp.has("next")) {
      return response;
    }
    /* „Гол" login/register за вече логнат → неутрален изход към dashboard. (Edge
       proxy няма DB достъп за hasShop; купувачът стига /account през AccountButton.) */
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
