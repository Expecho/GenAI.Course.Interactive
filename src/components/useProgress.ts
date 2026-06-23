"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "workshop-progress-v1";

type Progress = {
  /** id of the last topic the user was on (for resume) */
  last: string | null;
  /** ids of topics the user has completed */
  completed: string[];
};

/**
 * Course progress persisted to localStorage: the last-visited topic (so a
 * revisit resumes where you left off) and the set of completed topics.
 * `ready` is false until the stored value has been read on the client, so
 * callers can avoid acting on the default empty state during hydration.
 */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>({ last: null, completed: [] });
  const [ready, setReady] = useState(false);

  // Load once on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Progress>;
        setProgress({
          last: typeof parsed.last === "string" ? parsed.last : null,
          completed: Array.isArray(parsed.completed) ? parsed.completed : [],
        });
      }
    } catch {
      /* ignore malformed/unavailable storage */
    }
    setReady(true);
  }, []);

  // Persist on every change once we've loaded.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* ignore storage errors */
    }
  }, [progress, ready]);

  const setLast = useCallback((id: string) => {
    setProgress((p) => (p.last === id ? p : { ...p, last: id }));
  }, []);

  const reportedRef = useRef(new Set<string>());

  const markComplete = useCallback((id: string) => {
    setProgress((p) => {
      if (p.completed.includes(id)) return p;
      return { ...p, completed: [...p.completed, id] };
    });
    if (!reportedRef.current.has(id)) {
      reportedRef.current.add(id);
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: id }),
      }).catch(() => {});
    }
  }, []);

  const reset = useCallback(() => setProgress({ last: null, completed: [] }), []);

  return {
    ready,
    lastTopicId: progress.last,
    completed: progress.completed,
    setLast,
    markComplete,
    reset,
  };
}
