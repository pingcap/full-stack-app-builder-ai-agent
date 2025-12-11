import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    ["/projects", "/settings", "/"].includes(path) ||
    path.startsWith("/api/v1/") ||
    path.startsWith("/debug/") ||
    path.startsWith("/projects/") ||
    path.startsWith("/settings/") ||
    path.startsWith("/s/") ||
    path.startsWith("/admin/")
  ) {
    const session = await getSession();
    // THIS IS NOT SECURE!
    // This is the recommended approach to optimistically redirect users
    // We recommend handling auth checks in each page/route
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image).*)"],
};
