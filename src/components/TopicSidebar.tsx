"use client";

import type { Topic } from "@/workshop/topics";
import { ThemeToggle } from "./ThemeToggle";

export function TopicSidebar({
  topics,
  activeId,
  completed,
  onSelect,
  onReset,
}: {
  topics: Topic[];
  activeId: string;
  completed: Set<string>;
  onSelect: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <nav className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
      <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-[var(--fg)]">Generative AI Workshop</h1>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">Edit code · run it · watch it stream</p>
        </div>
        <ThemeToggle />
      </div>
      <ul className="flex-1 overflow-y-auto py-2">
        {topics.map((t) => {
          const active = t.id === activeId;
          const done = completed.has(t.id);
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors " +
                  (active
                    ? "bg-[var(--chip)] font-medium text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--chip)] hover:text-[var(--fg)]")
                }
              >
                <span>{t.title}</span>
                <span
                  aria-hidden="true"
                  className={
                    "text-xs " + (done ? "text-emerald-600 dark:text-emerald-400" : "text-transparent")
                  }
                >
                  ✓
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <p className="px-1 text-xs text-[var(--fg-subtle)]">
          {completed.size} of {topics.length} completed
        </p>
        <button
          onClick={onReset}
          className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
        >
          Reset progress
        </button>
      </div>
    </nav>
  );
}
