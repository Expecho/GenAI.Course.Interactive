export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { trackEvent, trackException } from "@/lib/telemetry"
import { getCourseRating, saveCourseRating, MAX_RATING } from "@/lib/tableStorage"

/** The signed-in participant's own rating, so the recap page can show it. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const rating = await getCourseRating(session.user.email)
    return NextResponse.json({ rating })
  } catch (err) {
    trackException(err, { source: "api/rating", op: "get" })
    console.error("[rating]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/** Sets (or changes) the participant's 0–5 star rating of the course. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let rating: unknown
    try {
      rating = (await req.json())?.rating
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 0 || rating > MAX_RATING) {
      return NextResponse.json({ error: `Rating must be a whole number from 0 to ${MAX_RATING}` }, { status: 400 })
    }

    await saveCourseRating({
      email: session.user.email,
      userName: session.user.name ?? "",
      rating,
    })
    trackEvent("course-rated", { rating })

    return NextResponse.json({ ok: true })
  } catch (err) {
    trackException(err, { source: "api/rating", op: "post" })
    console.error("[rating]", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
