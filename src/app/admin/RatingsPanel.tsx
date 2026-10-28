"use client";

import { useMemo } from "react";
import type { CourseRating } from "@/lib/tableStorage";

const MAX = 5;

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} of ${MAX} stars`} className="tracking-wider">
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-[var(--border-strong)]">{"★".repeat(MAX - rating)}</span>
    </span>
  );
}

export default function RatingsPanel({
  ratings,
  fmtDate,
}: {
  ratings: CourseRating[];
  fmtDate: (iso: string) => string;
}) {
  const { average, distribution } = useMemo(() => {
    const distribution = Array.from({ length: MAX + 1 }, () => 0);
    let sum = 0;
    for (const r of ratings) {
      distribution[r.rating]++;
      sum += r.rating;
    }
    return { average: ratings.length ? sum / ratings.length : null, distribution };
  }, [ratings]);

  const busiest = Math.max(1, ...distribution);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-0.5 bg-amber-500 opacity-60" />
          <p className="text-xs uppercase tracking-wider text-[var(--fg-muted)] mb-3 font-mono">
            Average rating
          </p>
          <p className="text-4xl font-bold text-amber-500">
            {average === null ? "—" : average.toFixed(1)}
            <span className="text-lg font-normal text-[var(--fg-muted)]"> / {MAX}</span>
          </p>
          <p className="text-xs text-[var(--fg-muted)] mt-2">
            from {ratings.length} rating{ratings.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="sm:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--fg-muted)] mb-3 font-mono">
            Distribution
          </p>
          <ul className="space-y-1.5">
            {distribution
              .map((count, stars) => ({ count, stars }))
              .reverse()
              .map(({ count, stars }) => (
                <li key={stars} className="flex items-center gap-3 text-xs">
                  <span className="w-8 text-right text-[var(--fg-muted)]">{stars} ★</span>
                  <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(count / busiest) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-[var(--fg)] font-medium">{count}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {/* Individual ratings */}
      {ratings.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-16 text-center text-sm text-[var(--fg-muted)]">
          No ratings yet. Participants can rate the course at the end of the recap.
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full">
            <tbody>
              {ratings.map((r) => (
                <tr
                  key={r.email}
                  className="border-b border-[var(--border)] last:border-none hover:bg-[var(--surface-sunken)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[var(--fg)]">
                        {r.userName || r.email.split("@")[0]}
                      </span>
                      <span className="text-xs text-[var(--fg-muted)]">{r.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-base whitespace-nowrap">
                    <Stars rating={r.rating} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[var(--fg-muted)] whitespace-nowrap">
                    {r.ratedAt ? fmtDate(r.ratedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-between text-xs text-[var(--fg-muted)]">
        <span>
          {ratings.length} rating{ratings.length !== 1 ? "s" : ""}
        </span>
        <span>CourseRating table</span>
      </div>
    </>
  );
}
