import type { ActivitiesQuery, ActivitiesResponse, Activity } from "@customaov/contracts";
import { and, count, desc, eq } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import { activities, activityRecipients } from "../db/schema.js";

type ActivityRow = typeof activities.$inferSelect;

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    kind: row.kind as Activity["kind"],
    text: row.text,
    ...(row.emphasis ? { emphasis: row.emphasis } : {}),
    at: row.createdAt.toISOString(),
  };
}

/**
 * Feed hoạt động của một người dùng: chỉ những hoạt động có `activity_recipients.user_id = userId`,
 * mới nhất ở trên (hoà thời gian thì xếp theo id để phân trang ổn định).
 */
export async function listMyActivities(
  db: Pick<DbClient, "select">,
  userId: string,
  query: ActivitiesQuery,
): Promise<ActivitiesResponse> {
  const { page, pageSize } = query;
  const mine = eq(activityRecipients.userId, userId);

  const [totalRow] = await db
    .select({ value: count() })
    .from(activityRecipients)
    .where(mine);

  const rows = await db
    .select({ activity: activities })
    .from(activityRecipients)
    .innerJoin(activities, and(eq(activities.id, activityRecipients.activityId), mine))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map((r) => toActivity(r.activity)),
    total: Number(totalRow?.value ?? 0),
    page,
    pageSize,
  };
}
