"use client";

import { useTheme } from "./ThemeProvider";

/** A small switch that toggles between light and dark themes. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex items-center gap-2 text-xs text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
    >
      <span>{isDark ? "🌙" : "☀️"}</span>
      <span
        className={
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
          (isDark ? "bg-[var(--info)]" : "bg-[var(--border-strong)]")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
            (isDark ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </span>
    </button>
  );
}
