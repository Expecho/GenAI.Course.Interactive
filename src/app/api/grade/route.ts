import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient, getDeployment } from "@/lib/azureClient";
import { trackEvent, trackException } from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  // Check the email, not just the session: in a production build `auth()`
  // resolves to a truthy object for an unauthenticated caller, so a bare
  // `!session` check lets anonymous requests spend Foundry quota.
  // (Same guard as /api/progress.)
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  const email = session.user.email;

  let question = "";
  let rubric = "";
  let answer = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "");
    rubric = String(body?.rubric ?? "");
    answer = String(body?.answer ?? "");
  } catch (err) {
    trackException(err, {
      source: "api/grade",
      phase: "request",
      reason: "invalid-json",
      email,
    });
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!answer.trim()) {
    return Response.json({ correct: false, feedback: "No answer provided." });
  }

  let client;
  try {
    client = createClient();
  } catch (err) {
    trackException(err, { source: "api/grade", phase: "config", email });
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  try {
    const res = await client.responses.create({
      model: getDeployment(),
      temperature: 0,
      input: [
        {
          role: "system",
          content:
            "You grade a learner's short answer to a concept question. " +
            "Decide whether the answer satisfies the grading criteria. Be lenient about " +
            "wording and synonyms; judge the meaning, not the exact phrasing. " +
            'Respond with ONLY compact JSON, no prose: {"correct": boolean, "feedback": string}. ' +
            "`feedback` is one short, friendly sentence explaining the verdict.",
        },
        {
          role: "user",
          content: `QUESTION:\n${question}\n\nGRADING CRITERIA:\n${rubric}\n\nLEARNER ANSWER:\n${answer}`,
        },
      ],
    });

    const text = res.output_text ?? "";
    const verdict = parseVerdict(text);
    return Response.json(verdict);
  } catch (err) {
    // The OpenAI SDK's APIError carries the detail worth keeping: which status
    // Azure returned, and the request id their support asks for.
    const e = err as Error & {
      status?: number;
      code?: string | null;
      type?: string;
      request_id?: string | null;
    };
    trackException(e, {
      source: "api/grade",
      phase: "api",
      email,
      httpStatus: e.status,
      errorCode: e.code,
      errorType: e.type,
      requestId: e.request_id,
      model: getDeployment(),
    });
    return Response.json({ error: e.message }, { status: 502 });
  }
}

function parseVerdict(text: string): { correct: boolean; feedback: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      return {
        correct: !!obj.correct,
        feedback: typeof obj.feedback === "string" ? obj.feedback : "",
      };
    } catch {
      // The model returned something that isn't the JSON we asked for. Not an
      // exception — a model-behaviour problem worth spotting as a trend.
      trackEvent("GradeParseFailure", {
        source: "api/grade",
        rawLength: text.length,
        rawPrefix: text.slice(0, 500),
      });
    }
  }
  return { correct: false, feedback: "Could not grade the answer — please try again." };
}
