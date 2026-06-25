"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface User {
  email: string;
  name: string;
  topics: number;
  lastActivity: string | null;
}

interface Props {
  users: User[];
  totalTopics: number;
}

type SortKey = "name" | "email" | "topics" | "status" | "date";
type FilterKey = "all" | "progress" | "complete";

export default function AdminDashboard({ users, totalTopics }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("topics");
  const [sortAsc, setSortAsc] = useState(false);

  const started = users.length;
  const completed = users.filter((u) => u.topics >= totalTopics).length;
  const rate = started ? Math.round((completed / started) * 100) : 0;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "email");
    }
  }

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = users.filter((u) => {
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false;
      if (filter === "complete" && u.topics < totalTopics) return false;
      if (filter === "progress" && u.topics >= totalTopics) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "email") {
        av = a.email.toLowerCase();
        bv = b.email.toLowerCase();
      } else if (sortKey === "status") {
        av = a.topics >= totalTopics ? 1 : 0;
        bv = b.topics >= totalTopics ? 1 : 0;
      } else if (sortKey === "date") {
        av = a.lastActivity ?? "";
        bv = b.lastActivity ?? "";
      } else {
        av = a.topics;
        bv = b.topics;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, search, filter, sortKey, sortAsc, totalTopics]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <span className="ml-1 opacity-40">↕</span>;
    return (
      <span className="ml-1 text-amber-500">{sortAsc ? "↑" : "↓"}</span>
    );
  }

  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const thClass =
    "px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] cursor-pointer hover:text-[var(--fg)] select-none whitespace-nowrap transition-colors";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 mb-10 pb-6 border-b border-[var(--border)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-500 font-medium mb-1 font-mono">
            Azure AI Foundry · Progress Tracker
          </p>
          <h1 className="text-3xl font-bold text-[var(--fg)]">
            Workshop Admin
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-[var(--border)] rounded bg-[var(--surface)] hover:border-amber-500 transition-colors disabled:opacity-50 text-[var(--fg)]"
        >
          <svg
            className={isPending ? "animate-spin" : ""}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Participants started",
            value: started,
            sub: "unique participants",
            highlight: false,
          },
          {
            label: "Completed",
            value: completed,
            sub: `all ${totalTopics} topics done`,
            highlight: false,
          },
          {
            label: "Completion rate",
            value: `${rate}%`,
            sub: "of participants",
            highlight: true,
          },
        ].map(({ label, value, sub, highlight }) => (
          <div
            key={label}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 relative overflow-hidden hover:border-[var(--border-strong)] transition-colors"
          >
            <div className="absolute inset-y-0 left-0 w-0.5 bg-amber-500 opacity-60" />
            <p className="text-xs uppercase tracking-wider text-[var(--fg-muted)] mb-3 font-mono">
              {label}
            </p>
            <p
              className={`text-4xl font-bold ${highlight ? "text-amber-500" : "text-[var(--fg)]"}`}
            >
              {value}
            </p>
            <p className="text-xs text-[var(--fg-muted)] mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] pointer-events-none"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded focus:outline-none focus:border-amber-500 text-[var(--fg)] placeholder:text-[var(--fg-muted)] transition-colors"
            type="text"
            placeholder="Filter by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 ml-auto">
          {(["all", "progress", "complete"] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs border rounded transition-colors ${
                filter === f
                  ? "border-amber-500 text-amber-500 bg-amber-500/10"
                  : "border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "progress"
                  ? "In progress"
                  : "Completed"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th
                className={`${thClass} ${sortKey === "name" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("name")}
              >
                Participant
                <SortIcon col="name" />
              </th>
              <th
                className={`${thClass} hidden sm:table-cell ${sortKey === "email" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("email")}
              >
                Email
                <SortIcon col="email" />
              </th>
              <th
                className={`${thClass} ${sortKey === "topics" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("topics")}
              >
                Progress
                <SortIcon col="topics" />
              </th>
              <th
                className={`${thClass} text-right ${sortKey === "topics" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("topics")}
              >
                Topics
                <SortIcon col="topics" />
              </th>
              <th
                className={`${thClass} ${sortKey === "status" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("status")}
              >
                Status
                <SortIcon col="status" />
              </th>
              <th
                className={`${thClass} hidden md:table-cell ${sortKey === "date" ? "text-amber-500" : ""}`}
                onClick={() => handleSort("date")}
              >
                Last activity
                <SortIcon col="date" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-16 text-center text-sm text-[var(--fg-muted)]"
                >
                  {users.length === 0
                    ? "No participants yet."
                    : "No participants match your filter."}
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const pct = Math.min(
                  Math.round((u.topics / totalTopics) * 100),
                  100,
                );
                const done = u.topics >= totalTopics;
                const name = u.name || u.email.split("@")[0];
                return (
                  <tr
                    key={u.email}
                    className="border-b border-[var(--border)] last:border-none hover:bg-[var(--surface-sunken)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-[var(--fg)]">
                          {name}
                        </span>
                        <span className="text-xs text-[var(--fg-muted)] sm:hidden">
                          {u.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)] hidden sm:table-cell">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-amber-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--fg-muted)]">
                        {pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--fg)]">
                      {u.topics}
                      <span className="text-[var(--fg-muted)] font-normal">
                        {" "}
                        /{totalTopics}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {done ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          In progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)] hidden md:table-cell">
                      {u.lastActivity ? fmtDate(u.lastActivity) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-between text-xs text-[var(--fg-muted)]">
        <span>
          Showing {rows.length} of {users.length} participant
          {users.length !== 1 ? "s" : ""}
        </span>
        <span>
          UserProgress table · {totalTopics} topics
        </span>
      </div>
    </div>
  );
}
