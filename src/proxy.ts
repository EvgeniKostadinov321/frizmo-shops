import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/* Next 16: файловата конвенция middleware е преименувана на proxy. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/auth/:path*"],
};
