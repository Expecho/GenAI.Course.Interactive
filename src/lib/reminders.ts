import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { topics } from "@/workshop/topics";
import {
  getAllUserProgress,
  getAllReminderStates,
  recordReminderSent,
} from "./tableStorage";
import { sendMail } from "./mail";
import { trackEvent, trackException } from "./telemetry";

/**
 * "Come back and finish the course" reminders.
 *
 * Someone gets a reminder when they have completed at least one numbered topic
 * but not all of them, haven't opted out, and it has been REMINDER_INTERVAL_DAYS
 * (default 28) since the later of their last completed topic and their last
 * reminder. So active learners are never nagged, and a reminder repeats every
 * interval until they finish or unsubscribe.
 *
 * Meant to be triggered once a day (see /api/reminders/run): a daily check
 * against the interval is more robust than a job that only fires every 4 weeks,
 * because a missed run just goes out the next day.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Only topics with code count: the text-only intro and recap are marked
 * complete just by opening them, so they don't show someone actually started.
 */
const courseTopics = topics.filter((t) => t.defaultCode !== undefined);
const courseTopicIds = new Set(courseTopics.map((t) => t.id));

/**
 * Exchange Online allows a mailbox about 30 messages a minute; stay under it.
 * Anyone over the per-run cap is still due tomorrow and gets picked up then.
 */
const SEND_SPACING_MS = 2_100;
const DEFAULT_MAX_PER_RUN = 50;

function intervalDays(): number {
  const n = Number(process.env.REMINDER_INTERVAL_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 28;
}

function maxPerRun(): number {
  const n = Number(process.env.REMINDER_MAX_PER_RUN);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_PER_RUN;
}

function baseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error("Missing APP_BASE_URL.");
  return url.replace(/\/+$/, "");
}

// ── Unsubscribe tokens ────────────────────────────────────────────────────────
// An HMAC of the email, so the link works without signing in but can't be
// forged to unsubscribe someone else.

function unsubscribeToken(email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET.");
  return createHmac("sha256", secret)
    .update("reminder-unsubscribe:" + email.toLowerCase())
    .digest("base64url");
}

export function isValidUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({ e: email.toLowerCase(), t: unsubscribeToken(email) });
  return `${baseUrl()}/api/reminders/unsubscribe?${params}`;
}

// ── Selecting who is due ──────────────────────────────────────────────────────

export interface DueReminder {
  email: string;
  name: string;
  completed: number;
  total: number;
  nextTopicId: string;
  nextTopicTitle: string;
  lastActivity: string | null;
  lastSentAt: string | null;
  sentCount: number;
}

export async function findDueReminders(now = new Date()): Promise<DueReminder[]> {
  const [users, states] = await Promise.all([getAllUserProgress(), getAllReminderStates()]);
  const cutoff = now.getTime() - intervalDays() * DAY_MS;

  const due: DueReminder[] = [];
  for (const user of users) {
    const done = new Set(user.topicIds.filter((id) => courseTopicIds.has(id)));
    if (done.size === 0 || done.size >= courseTopics.length) continue;

    const state = states.get(user.email.toLowerCase());
    if (state?.optedOut) continue;

    const lastTouch = Math.max(
      user.lastActivity ? Date.parse(user.lastActivity) : 0,
      state?.lastSentAt ? Date.parse(state.lastSentAt) : 0,
    );
    if (lastTouch > cutoff) continue;

    const next = courseTopics.find((t) => !done.has(t.id))!;
    due.push({
      email: user.email,
      name: user.name,
      completed: done.size,
      total: courseTopics.length,
      nextTopicId: next.id,
      nextTopicTitle: next.title,
      lastActivity: user.lastActivity,
      lastSentAt: state?.lastSentAt ?? null,
      sentCount: state?.sentCount ?? 0,
    });
  }

  // Longest-idle first, so the per-run cap never starves the same people.
  due.sort((a, b) => (a.lastActivity ?? "").localeCompare(b.lastActivity ?? ""));
  return due;
}

// ── The email ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderReminder(r: DueReminder): { subject: string; html: string } {
  const firstName = escapeHtml(r.name.split(" ")[0] || "there");
  const resumeUrl = `${baseUrl()}/?topic=${encodeURIComponent(r.nextTopicId)}`;
  const left = r.total - r.completed;

  const subject = `You're ${r.completed} of ${r.total} topics into the GenAI workshop`;
  const html = `<!doctype html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f2328;max-width:560px">
<p>Hi ${firstName},</p>
<p>You've completed <strong>${r.completed} of ${r.total}</strong> topics in the Generative AI workshop.
Only ${left} ${left === 1 ? "topic" : "topics"} to go!</p>
<p>Next up: <strong>${escapeHtml(r.nextTopicTitle)}</strong></p>
<p><a href="${escapeHtml(resumeUrl)}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">Pick up where you left off</a></p>
<p style="color:#656d76;font-size:12px;margin-top:32px">You get this reminder every ${intervalDays()} days while the workshop is unfinished.
<a href="${escapeHtml(unsubscribeUrl(r.email))}" style="color:#656d76">Stop these reminders</a>.</p>
</body></html>`;

  return { subject, html };
}

// ── Running ───────────────────────────────────────────────────────────────────

export interface ReminderRunResult {
  dryRun: boolean;
  due: number;
  sent: string[];
  failed: { email: string; error: string }[];
  /** Due but left for the next run because of the per-run cap. */
  deferred: number;
  preview?: DueReminder[];
}

let running = false;

/**
 * Sends every due reminder, unless `dryRun`, in which case it only returns who
 * would be reminded. Returns null if another run is already in progress.
 */
export async function runReminders({ dryRun }: { dryRun: boolean }): Promise<ReminderRunResult | null> {
  if (running) return null;
  running = true;
  try {
    const due = await findDueReminders();
    if (dryRun) {
      return { dryRun, due: due.length, sent: [], failed: [], deferred: 0, preview: due };
    }

    const batch = due.slice(0, maxPerRun());
    const result: ReminderRunResult = {
      dryRun,
      due: due.length,
      sent: [],
      failed: [],
      deferred: due.length - batch.length,
    };

    for (const [i, r] of batch.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS));
      try {
        const { subject, html } = renderReminder(r);
        await sendMail({ to: r.email, subject, html });
        await recordReminderSent(r.email, r.sentCount + 1);
        result.sent.push(r.email);
      } catch (err) {
        trackException(err, { source: "reminders", email: r.email });
        console.error(`[reminders] sending to ${r.email} failed:`, err);
        result.failed.push({ email: r.email, error: err instanceof Error ? err.message : String(err) });
      }
    }

    trackEvent("reminder-run", {
      due: result.due,
      sent: result.sent.length,
      failed: result.failed.length,
      deferred: result.deferred,
    });
    return result;
  } finally {
    running = false;
  }
}
