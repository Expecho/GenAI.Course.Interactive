import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/api/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  // Exclude: all /api/* routes, Next.js internals, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
