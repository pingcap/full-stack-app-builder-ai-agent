import type { NextRequest } from "next/server";
import withAuth from "next-auth/middleware";
import authOptions from "@/lib/auth-options";

const handler = withAuth({
  pages: authOptions.pages,
});

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    ["/projects", "/settings", "/"].includes(path) ||
    path.startsWith("/api/v1/") ||
    path.startsWith("/debug/") ||
    path.startsWith("/projects/") ||
    path.startsWith("/settings/") ||
    path.startsWith("/s/")
  ) {
    return handler(request as never, null as never);
  }
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image).*)"],
};
