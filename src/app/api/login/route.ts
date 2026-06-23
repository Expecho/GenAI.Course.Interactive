import { signIn } from "@/auth"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("callbackUrl") ?? "/"
  // Only allow same-origin relative paths — reject absolute URLs and protocol-relative //
  const safe = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
  await signIn("microsoft-entra-id", { redirectTo: safe ? raw : "/" })
}
