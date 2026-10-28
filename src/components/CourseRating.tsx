"use client";

import { useEffect, useState } from "react";

const MAX = 5;

type Status = "loading" | "idle" | "sending" | "sent" | "error";

/**
 * 0–5 star rating of the whole course, shown at the end of the recap. Each
 * participant has one rating; submitting again replaces it.
 */
export function CourseRating() {
  // `saved` is what the server has; `choice` is what's selected right now.
  const [saved, setSaved] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    fetch("/api/rating")
      .then((res) => (res.ok ? res.json() : { rating: null }))
      .then((body: { rating: number | null }) => {
        setSaved(body.rating);
        setChoice(body.rating);
      })
      .catch(() => {})
      .finally(() => setStatus("idle"));
  }, []);

  async function submit() {
    if (choice === null) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: choice }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(choice);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  function pick(n: number) {
    setChoice(n);
    if (status === "sent" || status === "error") setStatus("idle");
  }

  const shown = hover ?? choice ?? 0;
  const unchanged = choice === saved;

  return (
    <section className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold text-[var(--fg)]">How would you rate this course?</h2>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        From 0 to {MAX} stars. You can change your rating at any time.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
          <button
            onClick={() => pick(0)}
            onMouseEnter={() => setHover(0)}
            aria-label="0 stars"
            aria-pressed={choice === 0}
            disabled={status === "loading"}
            className={
              "mr-1 h-8 w-8 rounded-full border text-xs font-semibold transition-colors " +
              (choice === 0
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-[var(--border-strong)] text-[var(--fg-muted)] hover:border-amber-500")
            }
          >
            0
          </button>
          {Array.from({ length: MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => pick(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={choice === n}
              disabled={status === "loading"}
              className={
                "text-3xl leading-none transition-transform hover:scale-110 " +
                (n <= shown ? "text-amber-500" : "text-[var(--border-strong)]")
              }
            >
              ★
            </button>
          ))}
        </div>

        <span className="min-w-[4rem] text-sm text-[var(--fg-muted)]">
          {choice !== null || hover !== null ? `${shown} / ${MAX}` : ""}
        </span>

        <button
          onClick={submit}
          disabled={choice === null || unchanged || status === "sending" || status === "loading"}
          className="rounded-md bg-[var(--info)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--disabled)] disabled:text-[var(--fg-subtle)]"
        >
          {status === "sending" ? "Saving…" : saved === null ? "Submit rating" : "Update rating"}
        </button>
      </div>

      {status === "sent" && (
        <p className="mt-3 text-sm text-[var(--ok)]">Thanks for rating the course!</p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-[var(--danger)]">Couldn't save your rating. Please try again.</p>
      )}
      {status === "idle" && saved !== null && unchanged && (
        <p className="mt-3 text-xs text-[var(--fg-subtle)]">
          You rated the course {saved} / {MAX}.
        </p>
      )}
    </section>
  );
}
