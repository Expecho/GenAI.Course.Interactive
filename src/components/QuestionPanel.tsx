"use client";

import { useEffect, useState } from "react";
import { Markdown } from "./Markdown";
import type { RunState } from "./runState";

export type Question =
  | {
      // Numeric question, checked against the run's total_tokens.
      kind: "tokens";
      prompt: string;
      explanation: string;
    }
  | {
      // Free-text question, graded by the LLM against `rubric`.
      // `keywords` is an offline fallback used only if the grading call fails.
      kind: "text";
      prompt: string;
      rubric: string;
      keywords?: string[];
      explanation: string;
    };

/**
 * Inner content for the checkpoint step. Two flavours:
 *  - "tokens": a number checked against the response's `total_tokens`; a Hint
 *    reveals the answer; a wrong guess lets you retry.
 *  - "text": a free-text answer graded by the provisioned LLM against the
 *    question's rubric (keyword matching is only a fallback if that call fails).
 *    Either way (right or wrong) the explanation is revealed.
 * The surrounding step provides the box/heading.
 */
export function QuestionPanel({
  question,
  expected,
  runState,
  onCorrect,
}: {
  question: Question;
  expected: number | null;
  runState: RunState;
  onCorrect?: () => void;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<"idle" | "correct" | "wrong">("idle");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [revealed, setRevealed] = useState(false);

  // A new run produces a new token count — reset the token question.
  useEffect(() => {
    setValue("");
    setChecked("idle");
    setChecking(false);
    setFeedback("");
    setRevealed(false);
  }, [expected]);

  const tokensReady = question.kind !== "tokens" || expected !== null;
  const isText = question.kind === "text";

  function applyVerdict(correct: boolean, fb: string) {
    setChecked(correct ? "correct" : "wrong");
    setFeedback(fb);
    setRevealed(true);
    if (correct) onCorrect?.();
  }

  function checkTokens() {
    if (question.kind !== "tokens" || expected === null) return;
    const guess = Number(value.trim());
    if (!Number.isFinite(guess)) {
      setChecked("wrong");
      return;
    }
    if (guess === expected) {
      setChecked("correct");
      setRevealed(true);
      onCorrect?.();
    } else {
      setChecked("wrong");
    }
  }

  async function checkText() {
    if (question.kind !== "text") return;
    const answer = value.trim();
    if (!answer) return;
    setChecking(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.prompt, rubric: question.rubric, answer }),
      });
      if (!res.ok) throw new Error("grade request failed");
      const data = (await res.json()) as { correct?: boolean; feedback?: string; error?: string };
      if (data.error) throw new Error(data.error);
      applyVerdict(!!data.correct, data.feedback ?? "");
    } catch {
      // Fallback: keyword match if the LLM grader is unavailable.
      const lower = answer.toLowerCase();
      const hit = (question.keywords ?? []).some((k) => lower.includes(k.toLowerCase()));
      applyVerdict(hit, "");
    } finally {
      setChecking(false);
    }
  }

  const check = () => (isText ? checkText() : checkTokens());

  return (
    <div>
      <p className="text-base font-semibold text-[var(--fg)]">{question.prompt}</p>

      {!tokensReady && (
        <p className="mt-2 text-xs text-[var(--fg-subtle)]">
          {runState === "running"
            ? "Running… the answer will be checkable once the response comes back."
            : "Run the call first, then answer here."}
        </p>
      )}

      <div className={`mt-4 ${isText ? "space-y-2" : "flex flex-wrap items-center gap-2"}`}>
        {isText ? (
          <textarea
            rows={2}
            value={value}
            disabled={checking}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                check();
              }
            }}
            placeholder="Type your answer…"
            className="w-full max-w-lg rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none disabled:opacity-60"
          />
        ) : (
          <input
            type="number"
            inputMode="numeric"
            value={value}
            disabled={!tokensReady}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="answer"
            className="w-32 rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={check}
            disabled={!tokensReady || checking}
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--chip)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check"}
          </button>
          <button
            onClick={() => setRevealed(true)}
            disabled={!tokensReady || checking}
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isText ? "Show explanation" : "Hint"}
          </button>

          {!checking && checked === "correct" && (
            <span className="ml-1 text-sm font-medium text-[var(--ok)]">✓ Correct</span>
          )}
          {!checking && checked === "wrong" && (
            <span className="ml-1 text-sm font-medium text-[var(--warn)]">
              {isText ? "Not quite — here's what's going on:" : "Not quite — try again."}
            </span>
          )}
        </div>
      </div>

      {!checking && feedback && (checked === "correct" || checked === "wrong") && (
        <p className="mt-2 text-sm italic text-[var(--fg-muted)]">{feedback}</p>
      )}

      {revealed && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          {question.kind === "tokens" && expected !== null && (
            <p className="mb-3 text-sm text-[var(--fg-body)]">
              The answer is <span className="font-semibold text-[var(--fg)]">{expected}</span> tokens
              (the <code className="rounded bg-[var(--chip)] px-1 py-0.5">total_tokens</code> value).
            </p>
          )}
          <Markdown markdown={question.explanation} />
        </div>
      )}
    </div>
  );
}
