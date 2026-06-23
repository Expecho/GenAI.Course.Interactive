import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient, getDeployment } from "@/lib/azureClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let question = "";
  let rubric = "";
  let answer = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "");
    rubric = String(body?.rubric ?? "");
    answer = String(body?.answer ?? "");
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!answer.trim()) {
    return Response.json({ correct: false, feedback: "No answer provided." });
  }

  let client;
  try {
    client = createClient();
  } catch (err) {
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
    return Response.json({ error: (err as Error).message }, { status: 502 });
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
      /* fall through */
    }
  }
  return { correct: false, feedback: "Could not grade the answer — please try again." };
}
