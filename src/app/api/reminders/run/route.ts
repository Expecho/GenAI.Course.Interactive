export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { trackException } from "@/lib/telemetry"
import { runReminders } from "@/lib/reminders"

/**
 * Triggered daily by the scheduled Container Apps Job (see setup-reminders.ps1)
 * with `Authorization: Bearer $REMINDER_CRON_SECRET`.
 *
 * Emails are only sent when REMINDERS_ENABLED=true and the request doesn't ask
 * for `?dryRun=1`; otherwise it returns the list of people who would be reminded.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.REMINDER_CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(req.headers.get("authorization") ?? "")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const dryRun =
      process.env.REMINDERS_ENABLED !== "true" || req.nextUrl.searchParams.get("dryRun") === "1"
    const result = await runReminders({ dryRun })
    if (!result) {
      return NextResponse.json({ error: "A reminder run is already in progress" }, { status: 409 })
    }
    return NextResponse.json(result)
  } catch (err) {
    trackException(err, { source: "api/reminders/run" })
    console.error("[reminders]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
