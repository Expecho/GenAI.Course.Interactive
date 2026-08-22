export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { trackException } from "@/lib/telemetry"
import {
  logTopicComplete,
  logCourseComplete,
  getCompletedTopicCount,
  TOTAL_TOPICS,
} from "@/lib/tableStorage"
import { topics } from "@/workshop/topics"

const validTopicIds = new Set(topics.map((t) => t.id))

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let topicId: unknown
    try {
      const body = await req.json()
      topicId = body?.topicId
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    if (typeof topicId !== "string" || topicId.trim() === "") {
      return NextResponse.json({ error: "Invalid topicId" }, { status: 400 })
    }

    if (!validTopicIds.has(topicId)) {
      return NextResponse.json({ error: "Invalid topicId" }, { status: 400 })
    }

    const email = session.user.email
    const name = session.user.name ?? ""
    const userId = session.user.id ?? ""

    await logTopicComplete(email, name, userId, topicId)

    const count = await getCompletedTopicCount(email)
    if (count >= TOTAL_TOPICS) {
      await logCourseComplete(email, name, userId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    trackException(err, { source: "api/progress" })
    console.error("[activity-log]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
