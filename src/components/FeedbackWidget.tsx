"use client";

import { useEffect, useRef, useState } from "react";

const KINDS = [
  { id: "problem", label: "Problem", hint: "Something is broken or wrong" },
  { id: "suggestion", label: "Suggestion", hint: "An idea to make this better" },
  { id: "question", label: "Question", hint: "Something wasn't clear" },
  { id: "praise", label: "Praise", hint: "Something worked really well" },
] as const;

type Kind = (typeof KINDS)[number]["id"];
type Status = "idle" | "sending" | "sent" | "error";

/**
 * Floating "Feedback" button + panel, always available while working through a
 * topic. Everything is optional — the participant opens it only if they want to
 * say something — but whatever they send is automatically tagged with the topic
 * they were on, so the host knows where a problem actually happened.
 */
export function FeedbackWidget({
  topicId,
  topicTitle,
}: {
  topicId: string;
  topicTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("problem");
  const [message, setMessage] = useState("");
  const [aboutTopic, setAboutTopic] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the message box on open; Esc closes the panel.
  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Moving to another topic re-arms the "about this topic" tag, so a message
  // sent later isn't silently filed under a topic the participant has left.
  useEffect(() => {
    setAboutTopic(true);
  }, [topicId]);

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;

    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: trimmed,
          topicId: aboutTopic ? topicId : "",
          anonymous,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("sent");
      setMessage("");
      // Leave the confirmation up briefly, then close.
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1800);
    } catch {
      setStatus("error");
      setError("Couldn't send that — please try again.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] shadow-lg transition-colors hover:bg-[var(--chip)]"
        aria-label="Give feedback or report a problem"
      >
        <span aria-hidden>💬</span>
        Feedback
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Send feedback"
      className="fixed bottom-5 right-5 z-40 flex w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--fg)]">Send feedback</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-lg leading-none text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)]"
          aria-label="Close feedback panel"
        >
          ×
        </button>
      </div>

      {status === "sent" ? (
        <div className="px-4 py-8 text-center">
          <p className="text-2xl" aria-hidden>
            ✓
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--fg)]">Thanks — that's been sent.</p>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">We read every message.</p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                title={k.hint}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (kind === k.id
                    ? "border-[var(--info)] bg-[var(--info)] text-white"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--chip)] hover:text-[var(--fg)]")
                }
              >
                {k.label}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={5}
            maxLength={4000}
            placeholder={
              kind === "problem"
                ? "What went wrong? What did you expect to happen?"
                : "What's on your mind?"
            }
            className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--info)] focus:outline-none"
          />

          <label className="flex items-start gap-2 text-xs text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={aboutTopic}
              onChange={(e) => setAboutTopic(e.target.checked)}
              className="mt-0.5 accent-[var(--info)]"
            />
            <span>
              About{" "}
              <span className="font-medium text-[var(--fg)]">{topicTitle}</span>
              <span className="block text-[var(--fg-subtle)]">
                {aboutTopic
                  ? "This topic is attached to your message."
                  : "Sent as general feedback about the workshop."}
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-[var(--info)]"
            />
            Send anonymously
          </label>

          {status === "error" && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[0.7rem] text-[var(--fg-subtle)]">
              {message.length > 0 ? `${message.length}/4000` : "⌘/Ctrl + Enter to send"}
            </span>
            <button
              onClick={submit}
              disabled={!message.trim() || status === "sending"}
              className="rounded-md bg-[var(--info)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--disabled)] disabled:text-[var(--fg-subtle)]"
            >
              {status === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
