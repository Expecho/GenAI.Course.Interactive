import "server-only";
import { TableClient, odata, RestError } from "@azure/data-tables";
import { trackException } from "./telemetry";

export const TOTAL_TOPICS = 17;

const USER_ACTIVITY_TABLE = "UserActivity";
const USER_PROGRESS_TABLE = "UserProgress";
const USER_FEEDBACK_TABLE = "UserFeedback";

/** Lazy singleton map: tableName -> TableClient */
const _clients: Map<string, TableClient> = new Map();

function getClient(tableName: string): TableClient {
  const existing = _clients.get(tableName);
  if (existing) return existing;

  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) {
    throw new Error(
      "Missing required environment variable AZURE_STORAGE_CONNECTION_STRING.",
    );
  }

  const client = TableClient.fromConnectionString(connStr, tableName);
  _clients.set(tableName, client);
  return client;
}

/** Fire-and-forget: ensure the tables exist at module load time. */
(async () => {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) return; // skip in build/test environments

  for (const tableName of [USER_ACTIVITY_TABLE, USER_PROGRESS_TABLE, USER_FEEDBACK_TABLE]) {
    try {
      await getClient(tableName).createTable();
    } catch (err) {
      if (err instanceof RestError && err.statusCode === 409) {
        // Table already exists — that's fine
      } else {
        trackException(err, { source: "tableStorage", op: "createTable", tableName });
        console.error(`[tableStorage] Failed to create table "${tableName}":`, err);
      }
    }
  }
})();

/**
 * Logs a login event into the UserActivity table.
 */
export async function logLoginEvent(user: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}): Promise<void> {
  if (!user.email) {
    console.warn("[activity-log] logLoginEvent called without email");
    return;
  }

  const client = getClient(USER_ACTIVITY_TABLE);
  const partitionKey = user.email.toLowerCase();
  const rowKey = "login-" + new Date().toISOString();

  try {
    await client.upsertEntity(
      {
        partitionKey,
        rowKey,
        eventType: "login",
        userName: user.name ?? "",
        userId: user.id ?? "",
        timestamp: new Date().toISOString(),
      },
      "Merge",
    );
  } catch (err) {
    trackException(err, { source: "tableStorage", op: "logLoginEvent", email: partitionKey });
    console.error("[activity-log] logLoginEvent failed:", err);
  }
}

/**
 * Records a topic completion in UserProgress and appends an activity event.
 */
export async function logTopicComplete(
  email: string,
  name: string,
  userId: string,
  topicId: string,
): Promise<void> {
  try {
    const pk = email.toLowerCase();

    // Upsert into UserProgress
    const progressClient = getClient(USER_PROGRESS_TABLE);
    await progressClient.upsertEntity(
      {
        partitionKey: pk,
        rowKey: topicId,
        completedAt: new Date().toISOString(),
        userName: name,
      },
      "Merge",
    );

    // Append to UserActivity
    const activityClient = getClient(USER_ACTIVITY_TABLE);
    await activityClient.upsertEntity(
      {
        partitionKey: pk,
        rowKey: "topic-" + topicId + "-" + new Date().toISOString(),
        eventType: "topic-complete",
        topicId,
        userName: name,
        userId,
        timestamp: new Date().toISOString(),
      },
      "Merge",
    );
  } catch (err) {
    trackException(err, { source: "tableStorage", op: "logTopicComplete", email, topicId });
    console.error("[activity-log] logTopicComplete failed:", err);
  }
}

/**
 * Appends a course-complete event to UserActivity.
 * Uses createEntity (not upsert) — silently ignores duplicate (HTTP 409).
 */
export async function logCourseComplete(
  email: string,
  name: string,
  userId: string,
): Promise<void> {
  const activityClient = getClient(USER_ACTIVITY_TABLE);
  try {
    await activityClient.createEntity({
      partitionKey: email.toLowerCase(),
      rowKey: "course-complete",
      eventType: "course-complete",
      userName: name,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 409) {
      // Already logged — ignore
    } else {
      trackException(err, { source: "tableStorage", op: "logCourseComplete", email });
      console.error("[activity-log] logCourseComplete failed:", err);
    }
  }
}

export interface UserProgressSummary {
  email: string;
  name: string;
  topics: number;
  lastActivity: string | null;
}

/**
 * Returns a summary of all users' progress, grouped by email.
 */
export async function getAllUserProgress(): Promise<UserProgressSummary[]> {
  const progressClient = getClient(USER_PROGRESS_TABLE);
  const entities = progressClient.listEntities<{
    partitionKey: string;
    rowKey: string;
    completedAt?: string;
    userName?: string;
  }>();

  const map = new Map<string, UserProgressSummary>();

  for await (const entity of entities) {
    const email = entity.partitionKey;
    const existing = map.get(email);
    const lastActivity = entity.completedAt ?? null;

    if (!existing) {
      map.set(email, { email, name: entity.userName ?? "", topics: 1, lastActivity });
    } else {
      existing.topics++;
      if (!existing.name && entity.userName) existing.name = entity.userName;
      if (lastActivity && (!existing.lastActivity || lastActivity > existing.lastActivity)) {
        existing.lastActivity = lastActivity;
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Returns the number of topics this user has completed.
 */
export async function getCompletedTopicCount(email: string): Promise<number> {
  const progressClient = getClient(USER_PROGRESS_TABLE);
  const filter = odata`PartitionKey eq ${email.toLowerCase()}`;
  const entities = progressClient.listEntities({ queryOptions: { filter } });

  let count = 0;
  for await (const _entity of entities) {
    count++;
  }
  return count;
}

/** The kinds of feedback a participant can send from the workshop. */
export const FEEDBACK_KINDS = ["problem", "suggestion", "praise", "question"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Partition used when feedback isn't tied to a specific topic. */
export const FEEDBACK_GENERAL = "general";

export interface FeedbackEntry {
  id: string;
  kind: FeedbackKind;
  message: string;
  /** Topic the participant was on, or FEEDBACK_GENERAL. */
  topicId: string;
  topicTitle: string;
  /** Empty when the participant chose to stay anonymous. */
  email: string;
  userName: string;
  createdAt: string;
}

/**
 * Stores one piece of participant feedback.
 *
 * Partitioned by topic so the admin view can group "what went wrong where"
 * cheaply, and so anonymous entries need no user identity at all. The row key
 * is a reverse timestamp, which makes Table Storage return newest-first for
 * free, with a random suffix so two submissions in the same millisecond can't
 * collide.
 */
export async function logFeedback(entry: {
  kind: FeedbackKind;
  message: string;
  topicId: string;
  topicTitle: string;
  email: string;
  userName: string;
}): Promise<void> {
  const client = getClient(USER_FEEDBACK_TABLE);
  const now = new Date();
  // 9_999_999_999_999 - epochMs: descending lexical order, fixed width.
  const reverse = String(9999999999999 - now.getTime()).padStart(13, "0");
  const rowKey = `${reverse}-${Math.random().toString(36).slice(2, 10)}`;

  const row = {
    partitionKey: entry.topicId,
    rowKey,
    kind: entry.kind,
    message: entry.message,
    topicId: entry.topicId,
    topicTitle: entry.topicTitle,
    email: entry.email,
    userName: entry.userName,
    createdAt: now.toISOString(),
  };

  try {
    try {
      await client.createEntity(row);
    } catch (err) {
      // The table is created fire-and-forget at module load, so a submission
      // arriving before that lands (or into a topic partition on a brand-new
      // table) would otherwise be lost. Create it and retry once.
      if (err instanceof RestError && err.statusCode === 404) {
        await client.createTable();
        await client.createEntity(row);
      } else {
        throw err;
      }
    }
  } catch (err) {
    trackException(err, {
      source: "tableStorage",
      op: "logFeedback",
      topicId: entry.topicId,
      kind: entry.kind,
    });
    // Unlike the activity log, feedback failures are surfaced to the caller so
    // the participant is told their message didn't arrive.
    throw err;
  }
}

/** Returns all feedback, newest first. */
export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  const client = getClient(USER_FEEDBACK_TABLE);
  const entities = client.listEntities<{
    partitionKey: string;
    rowKey: string;
    kind?: string;
    message?: string;
    topicId?: string;
    topicTitle?: string;
    email?: string;
    userName?: string;
    createdAt?: string;
  }>();

  const out: FeedbackEntry[] = [];
  for await (const e of entities) {
    out.push({
      id: `${e.partitionKey}/${e.rowKey}`,
      kind: (FEEDBACK_KINDS as readonly string[]).includes(e.kind ?? "")
        ? (e.kind as FeedbackKind)
        : "suggestion",
      message: e.message ?? "",
      topicId: e.topicId ?? e.partitionKey,
      topicTitle: e.topicTitle ?? "",
      email: e.email ?? "",
      userName: e.userName ?? "",
      createdAt: e.createdAt ?? "",
    });
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out;
}
