"use client";

import { useEffect, useState, type ReactNode } from "react";
import Editor from "@monaco-editor/react";
import type { Topic } from "@/workshop/topics";
import { Markdown } from "./Markdown";
import { QuestionPanel } from "./QuestionPanel";
import { useCodeRun, type CodeRun } from "./useCodeRun";
import { useTheme } from "./ThemeProvider";

export function CodeRunner({
  topic,
  onComplete,
  prev,
  next,
  onNavigate,
}: {
  topic: Topic;
  onComplete?: () => void;
  prev?: Topic;
  next?: Topic;
  onNavigate?: (id: string) => void;
}) {
  const primary = useCodeRun(topic.defaultCode ?? "");
  const fix = useCodeRun(topic.followUp?.code ?? "");
  const [correct, setCorrect] = useState(false);
  const [answered, setAnswered] = useState(false);

  // A topic counts as complete once the learner has done everything it asks of
  // them: answered the checkpoint question (correct OR incorrect) and run the
  // follow-up block — for whichever of those the topic actually has. A topic
  // with neither (the text-only intro) is complete as soon as it's opened.
  const questionDone = !topic.question || answered;
  const followUpDone = !topic.followUp || (fix.ran && fix.state !== "error");
  useEffect(() => {
    if (questionDone && followUpDone) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionDone, followUpDone]);

  // Text-only topics (e.g. the course introduction) have no editable code.
  if (topic.defaultCode === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Markdown markdown={topic.description} />
        <TopicNav prev={prev} next={next} onNavigate={onNavigate} />
      </div>
    );
  }

  const { subtitle, body } = splitConcept(topic.description);
  const codeStatus = (r: CodeRun): StepStatus => (r.ran && r.state !== "error" ? "done" : "active");
  const seenStatus = (r: CodeRun): StepStatus => (r.ran && r.state !== "error" ? "done" : "upcoming");

  const steps: StepDesc[] = [];

  steps.push({
    status: "concept",
    title: subtitle ? `Concept · ${subtitle}` : "Concept",
    content: <Markdown markdown={body} />,
  });

  steps.push({
    status: codeStatus(primary),
    title: topic.followUp ? "Run it" : "Run the call",
    action: <RunButton run={primary} />,
    content: <CodeEditor run={primary} />,
  });

  steps.push({
    status: seenStatus(primary),
    title: "Answer",
    content: <AnswerContent run={primary} />,
  });

  if (topic.question) {
    steps.push({
      status: correct ? "done" : "checkpoint",
      title: "",
      checkpoint: true,
      content: (
        <QuestionPanel
          question={topic.question}
          expected={primary.totalTokens}
          runState={primary.state}
          onCorrect={() => setCorrect(true)}
          onAnswered={() => setAnswered(true)}
        />
      ),
    });
  }

  if (topic.followUp) {
    const fu = topic.followUp;
    steps.push({
      status: codeStatus(fix),
      title: "Now give it memory",
      action: <RunButton run={fix} />,
      content: (
        <div className="space-y-4">
          <Markdown markdown={fu.intro} />
          <CodeEditor run={fix} />
        </div>
      ),
    });
    steps.push({
      status: seenStatus(fix),
      title: "Answer",
      content: <AnswerContent run={fix} />,
    });
    steps.push({
      status: fix.ran && fix.state !== "error" ? "done" : "upcoming",
      title: "What this means",
      content:
        fix.ran && fix.state !== "error" ? (
          <Markdown markdown={fu.explanation} />
        ) : (
          <p className="text-sm text-[var(--fg-subtle)]">
            Run the fixed version above to reveal what this means.
          </p>
        ),
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <Step
            key={i}
            n={i + 1}
            status={s.status}
            title={s.title}
            action={s.action}
            checkpoint={s.checkpoint}
            last={i === steps.length - 1}
          >
            {s.content}
          </Step>
        ))}
      </ol>
      <TopicNav prev={prev} next={next} onNavigate={onNavigate} />
    </div>
  );
}

/** Previous / next links at the bottom of a topic page. */
function TopicNav({
  prev,
  next,
  onNavigate,
}: {
  prev?: Topic;
  next?: Topic;
  onNavigate?: (id: string) => void;
}) {
  if (!prev && !next) return null;

  const linkClass =
    "flex max-w-[48%] flex-col gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-colors hover:bg-[var(--chip)]";

  return (
    <nav className="mt-8 flex items-stretch justify-between gap-3 border-t border-[var(--border)] pt-6">
      {prev ? (
        <button onClick={() => onNavigate?.(prev.id)} className={linkClass}>
          <span className="text-xs text-[var(--fg-subtle)]">← Previous</span>
          <span className="font-medium text-[var(--fg)]">{prev.title}</span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button onClick={() => onNavigate?.(next.id)} className={`${linkClass} ml-auto text-right`}>
          <span className="text-xs text-[var(--fg-subtle)]">Next →</span>
          <span className="font-medium text-[var(--fg)]">{next.title}</span>
        </button>
      ) : (
        <span />
      )}
    </nav>
  );
}

type StepDesc = {
  status: StepStatus;
  title: string;
  action?: ReactNode;
  checkpoint?: boolean;
  content: ReactNode;
};

function RunButton({ run }: { run: CodeRun }) {
  return (
    <button
      onClick={run.run}
      disabled={run.state === "running"}
      className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-[var(--disabled)]"
    >
      {run.state === "running" ? "Running…" : "▷ Run"}
    </button>
  );
}

function CodeEditor({ run }: { run: CodeRun }) {
  const { theme } = useTheme();
  const height = Math.min(460, Math.max(120, run.code.split("\n").length * 19 + 24));
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <Editor
        height={height}
        defaultLanguage="typescript"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={run.code}
        onChange={(v) => run.setCode(v ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          lineNumbers: "off",
          folding: false,
          renderLineHighlight: "none",
          scrollbar: { vertical: "auto", alwaysConsumeMouseWheel: false },
        }}
      />
    </div>
  );
}

function AnswerContent({ run }: { run: CodeRun }) {
  const [showRaw, setShowRaw] = useState(false);
  const hasResult = run.ran && run.state !== "error";
  // Streamed text (live deltas) takes precedence over a returned answer.
  const text = run.streamed || run.answer;

  if (run.state === "running" && !text && !run.imageUrl) {
    return <p className="text-sm text-[var(--fg-subtle)]">Waiting for the model…</p>;
  }
  if (!(hasResult || text || run.imageUrl)) {
    return <p className="text-sm text-[var(--fg-subtle)]">Run the code above to see the answer.</p>;
  }

  return (
    <>
      {run.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={run.imageUrl}
          alt="Generated image"
          className="mb-3 max-h-96 w-auto rounded-lg border border-[var(--border)]"
        />
      )}
      {(text || !run.imageUrl) && (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--fg)]">
          {text || "(no text output — see the raw response)"}
          {run.state === "running" && run.streamed && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-[var(--fg-muted)] align-middle" />
          )}
        </p>
      )}
      {(run.rawJson || run.logs.length > 0) && (
        <div className="mt-4">
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--info)] hover:opacity-80"
          >
            <span className="text-xs">{showRaw ? "▴" : "▾"}</span>
            {showRaw ? "Hide raw response & usage" : "Show raw response & usage"}
          </button>
          {showRaw && (
            <div className="mt-3 space-y-3">
              {run.logs.length > 0 && (
                <pre className="overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 font-mono text-xs leading-relaxed">
                  {run.logs.map((l, i) => (
                    <div key={i} className={l.error ? "text-[var(--danger)]" : "text-[var(--fg-body)]"}>
                      {l.text}
                    </div>
                  ))}
                </pre>
              )}
              {run.rawJson && (
                <pre className="max-h-80 overflow-auto rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] p-3 font-mono text-xs leading-relaxed text-[var(--fg-body)]">
                  {run.rawJson}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

type StepStatus = "concept" | "active" | "done" | "upcoming" | "checkpoint";

/**
 * One node in the vertical lesson timeline: a status circle + connecting line on
 * the left, and a titled content box on the right.
 */
function Step({
  n,
  status,
  title,
  children,
  last,
  action,
  checkpoint,
}: {
  n: number;
  status: StepStatus;
  title: string;
  children: ReactNode;
  last: boolean;
  action?: ReactNode;
  checkpoint?: boolean;
}) {
  return (
    <li className="relative pl-14">
      {!last && (
        <span
          aria-hidden
          className="absolute left-[1.4rem] top-9 bottom-[-1.75rem] w-px bg-[var(--border)]"
        />
      )}
      <StepCircle status={status} n={n} checkpoint={checkpoint} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5">
            <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
            {action}
          </div>
        )}
        <div className={title ? "border-t border-[var(--border)] p-5" : "p-5"}>{children}</div>
      </div>
    </li>
  );
}

function StepCircle({
  status,
  n,
  checkpoint,
}: {
  status: StepStatus;
  n: number;
  checkpoint?: boolean;
}) {
  const base =
    "absolute left-2 top-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold";

  if (status === "done") {
    return (
      <span className={`${base} bg-[var(--ok-bg)] text-[var(--ok)] ring-1 ring-[var(--ok)]`}>✓</span>
    );
  }
  if (checkpoint) {
    return (
      <span className={`${base} bg-[var(--warn-bg)] text-[var(--warn)] ring-1 ring-[var(--warn)]`}>?</span>
    );
  }
  if (status === "active") {
    return <span className={`${base} bg-[var(--info)] text-white`}>{n}</span>;
  }
  if (status === "concept") {
    return <span className={`${base} bg-[var(--chip)] text-[var(--fg-body)]`}>{n}</span>;
  }
  return <span className={`${base} bg-[var(--chip)] text-[var(--fg-subtle)]`}>{n}</span>;
}

/** Split a concept description into a "## subtitle" (if present) and the body. */
function splitConcept(markdown: string): { subtitle: string; body: string } {
  const lines = markdown.split("\n");
  if (lines[0]?.startsWith("## ")) {
    return { subtitle: lines[0].slice(3).trim(), body: lines.slice(1).join("\n").trim() };
  }
  return { subtitle: "", body: markdown };
}
