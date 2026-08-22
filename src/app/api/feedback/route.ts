export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { trackEvent, trackException } from "@/lib/telemetry"
import {
  logFeedback,
  FEEDBACK_KINDS,
  FEEDBACK_GENERAL,
  type FeedbackKind,
} from "@/lib/tableStorage"
import { topics } from "@/workshop/topics"

/** Table Storage caps a string property at 32k chars; keep messages far below. */
const MAX_MESSAGE_CHARS = 4000

const topicsById = new Map(topics.map((t) => [t.id, t]))

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const kind = body?.kind
    if (typeof kind !== "string" || !(FEEDBACK_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
    }

    const rawMessage = body?.message
    if (typeof rawMessage !== "string" || rawMessage.trim() === "") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    const message = rawMessage.trim().slice(0, MAX_MESSAGE_CHARS)

    // An unknown or omitted topicId falls back to general feedback rather than
    // failing — the message matters more than the context tag.
    const rawTopicId = typeof body?.topicId === "string" ? body.topicId : ""
    const topic = topicsById.get(rawTopicId)
    const topicId = topic ? topic.id : FEEDBACK_GENERAL
    const topicTitle = topic ? topic.title : "General"

    const anonymous = body?.anonymous === true

    await logFeedback({
      kind: kind as FeedbackKind,
      message,
      topicId,
      topicTitle,
      email: anonymous ? "" : session.user.email.toLowerCase(),
      userName: anonymous ? "" : (session.user.name ?? ""),
    })

    // The message itself is deliberately not sent to App Insights — only that
    // feedback arrived, and for what.
    trackEvent("feedback-submitted", { kind, topicId, anonymous })

    return NextResponse.json({ ok: true })
  } catch (err) {
    trackException(err, { source: "api/feedback" })
    console.error("[feedback]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
