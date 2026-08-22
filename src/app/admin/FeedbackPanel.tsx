"use client";

import { useMemo, useState } from "react";
import type { FeedbackEntry, FeedbackKind } from "@/lib/tableStorage";

const KIND_STYLE: Record<FeedbackKind, { label: string; className: string }> = {
  problem: {
    label: "Problem",
    className: "bg-red-500/10 text-red-500 border-red-500/25",
  },
  suggestion: {
    label: "Suggestion",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  },
  question: {
    label: "Question",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/25",
  },
  praise: {
    label: "Praise",
    className: "bg-green-500/10 text-green-500 border-green-500/25",
  },
};

type KindFilter = FeedbackKind | "all";

export default function FeedbackPanel({
  feedback,
  fmtDate,
}: {
  feedback: FeedbackEntry[];
  fmtDate: (iso: string) => string;
}) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: feedback.length };
    for (const f of feedback) c[f.kind] = (c[f.kind] ?? 0) + 1;
    return c;
  }, [feedback]);

  // Topics ordered by how much feedback they drew — the noisiest first is what
  // the host actually wants to see.
  const topicOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number }>();
    for (const f of feedback) {
      const existing = map.get(f.topicId);
      if (existing) existing.count++;
      else map.set(f.topicId, { id: f.topicId, title: f.topicTitle || f.topicId, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [feedback]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return feedback.filter((f) => {
      if (kindFilter !== "all" && f.kind !== kindFilter) return false;
      if (topicFilter !== "all" && f.topicId !== topicFilter) return false;
      if (
        q &&
        !f.message.toLowerCase().includes(q) &&
        !f.topicTitle.toLowerCase().includes(q) &&
        !f.email.toLowerCase().includes(q) &&
        !f.userName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [feedback, kindFilter, topicFilter, search]);

  return (
    <>
      {/* Per-kind stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {(Object.keys(KIND_STYLE) as FeedbackKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter((f) => (f === k ? "all" : k))}
            className={`text-left bg-[var(--surface)] border rounded-lg p-5 relative overflow-hidden transition-colors ${
              kindFilter === k
                ? "border-amber-500"
                : "border-[var(--border)] hover:border-[var(--border-strong)]"
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-[var(--fg-muted)] mb-3 font-mono">
              {KIND_STYLE[k].label}
            </p>
            <p className="text-3xl font-bold text-[var(--fg)]">{counts[k] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="flex-1 min-w-[12rem] max-w-xs px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded focus:outline-none focus:border-amber-500 text-[var(--fg)] placeholder:text-[var(--fg-muted)] transition-colors"
          type="text"
          placeholder="Search messages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded focus:outline-none focus:border-amber-500 text-[var(--fg)] transition-colors"
        >
          <option value="all">All topics</option>
          {topicOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.count})
            </option>
          ))}
        </select>
        {(kindFilter !== "all" || topicFilter !== "all" || search) && (
          <button
            onClick={() => {
              setKindFilter("all");
              setTopicFilter("all");
              setSearch("");
            }}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Messages */}
      {rows.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-16 text-center text-sm text-[var(--fg-muted)]">
          {feedback.length === 0
            ? "No feedback submitted yet."
            : "No feedback matches your filter."}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li
              key={f.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${KIND_STYLE[f.kind].className}`}
                >
                  {KIND_STYLE[f.kind].label}
                </span>
                <span className="px-2.5 py-1 rounded text-xs bg-[var(--chip)] text-[var(--fg-body)]">
                  {f.topicTitle || f.topicId}
                </span>
                <span className="ml-auto text-xs text-[var(--fg-muted)]">
                  {f.createdAt ? fmtDate(f.createdAt) : "—"}
                </span>
              </div>
              <p className="text-sm text-[var(--fg)] whitespace-pre-wrap leading-relaxed">
                {f.message}
              </p>
              <p className="mt-3 text-xs text-[var(--fg-muted)]">
                {f.email ? (
                  <>
                    {f.userName || f.email.split("@")[0]}
                    <span className="text-[var(--fg-subtle)]"> · {f.email}</span>
                  </>
                ) : (
                  <span className="italic text-[var(--fg-subtle)]">Anonymous</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-between text-xs text-[var(--fg-muted)]">
        <span>
          Showing {rows.length} of {feedback.length} message
          {feedback.length !== 1 ? "s" : ""}
        </span>
        <span>UserFeedback table</span>
      </div>
    </>
  );
}
