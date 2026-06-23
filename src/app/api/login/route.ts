import { signIn } from "@/auth"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "/"
  await signIn("microsoft-entra-id", { redirectTo: callbackUrl })
}
