import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/api/login", req.nextUrl.origin)
    // Keep the query string so deep links (e.g. ?topic=) survive sign-in.
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  // Exclude: all /api/* routes, Next.js internals, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
