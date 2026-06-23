import "server-only";
import { TableClient, odata, RestError } from "@azure/data-tables";

export const TOTAL_TOPICS = 18;

const USER_ACTIVITY_TABLE = "UserActivity";
const USER_PROGRESS_TABLE = "UserProgress";

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

/** Fire-and-forget: ensure both tables exist at module load time. */
(async () => {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) return; // skip in build/test environments

  for (const tableName of [USER_ACTIVITY_TABLE, USER_PROGRESS_TABLE]) {
    try {
      await getClient(tableName).createTable();
    } catch (err) {
      if (err instanceof RestError && err.statusCode === 409) {
        // Table already exists — that's fine
      } else {
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
      console.error("[activity-log] logCourseComplete failed:", err);
    }
  }
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
