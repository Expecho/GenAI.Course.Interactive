"use client";

import type { Topic } from "@/workshop/topics";
import { ThemeToggle } from "./ThemeToggle";

export function TopicSidebar({
  topics,
  activeId,
  onSelect,
}: {
  topics: Topic[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)]">
      <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-[var(--fg)]">GenAI Workshop</h1>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">Edit code · run it · watch it stream</p>
        </div>
        <ThemeToggle />
      </div>
      <ul className="flex-1 overflow-y-auto py-2">
        {topics.map((t) => {
          const active = t.id === activeId;
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={
                  "w-full px-4 py-2 text-left text-sm transition-colors " +
                  (active
                    ? "bg-[var(--chip)] font-medium text-[var(--fg)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--chip)] hover:text-[var(--fg)]")
                }
              >
                {t.title}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
