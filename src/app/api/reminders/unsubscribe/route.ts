export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { trackEvent, trackException } from "@/lib/telemetry"
import { setReminderOptOut } from "@/lib/tableStorage"
import { isValidUnsubscribeToken } from "@/lib/reminders"

/**
 * The "stop these reminders" link from the reminder email. Works without
 * signing in: the signed token in the link proves it came from that email.
 *
 * GET only shows a confirmation button and POST does the actual change, because
 * mail security scanners (e.g. Defender Safe Links) open every link in an email
 * and would otherwise unsubscribe everyone on delivery.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function page(body: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Workshop reminders</title>
<style>
  body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#fafaf9;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
  main{max-width:440px;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:28px}
  h1{font-size:20px;margin:0 0 12px}
  p{line-height:1.5}
  button{font:inherit;background:#d97706;color:#fff;border:0;border-radius:6px;padding:10px 18px;cursor:pointer}
  button.secondary{background:transparent;color:#57534e;text-decoration:underline;padding:0}
</style></head>
<body><main>${body}</main></body></html>`
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
}

function form(email: string, token: string, action: "unsubscribe" | "resubscribe", label: string, cls = "") {
  return `<form method="post">
  <input type="hidden" name="e" value="${escapeHtml(email)}">
  <input type="hidden" name="t" value="${escapeHtml(token)}">
  <input type="hidden" name="action" value="${action}">
  <button type="submit"${cls ? ` class="${cls}"` : ""}>${label}</button>
</form>`
}

const invalidLink = () =>
  page(`<h1>This link isn't valid</h1><p>Use the link from the most recent reminder email.</p>`, 400)

function valid(email: string | null, token: string | null): email is string {
  return !!email && !!token && isValidUnsubscribeToken(email, token)
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e")
  const token = req.nextUrl.searchParams.get("t")
  if (!valid(email, token)) return invalidLink()

  return page(`<h1>Stop workshop reminders?</h1>
<p>You'll no longer get emails reminding <strong>${escapeHtml(email)}</strong> to finish the Generative AI workshop.</p>
${form(email, token!, "unsubscribe", "Stop reminders")}`)
}

export async function POST(req: NextRequest) {
  const data = await req.formData().catch(() => null)
  const email = data?.get("e")?.toString() ?? null
  const token = data?.get("t")?.toString() ?? null
  const action = data?.get("action")?.toString()
  if (!valid(email, token) || (action !== "unsubscribe" && action !== "resubscribe")) {
    return invalidLink()
  }

  try {
    const optedOut = action === "unsubscribe"
    await setReminderOptOut(email, optedOut)
    trackEvent("reminder-opt-out-changed", { optedOut })

    return optedOut
      ? page(`<h1>Reminders stopped</h1>
<p>You won't get any more reminder emails. Your progress is kept, so you can still finish the workshop any time.</p>
${form(email, token!, "resubscribe", "Changed your mind? Turn reminders back on", "secondary")}`)
      : page(`<h1>Reminders back on</h1><p>You'll get a reminder every few weeks until you finish the workshop.</p>`)
  } catch (err) {
    trackException(err, { source: "api/reminders/unsubscribe" })
    console.error("[reminders] opt-out failed:", err)
    return page(`<h1>Something went wrong</h1><p>Please try again in a moment.</p>`, 500)
  }
}
