import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const signinUrl = new URL(
      "/api/auth/signin/microsoft-entra-id",
      req.nextUrl.origin
    )
    signinUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(signinUrl)
  }
})

export const config = {
  // Exclude: all /api/* routes, Next.js internals, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
