import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Me } from "@customaov/contracts";

import type { DbClient } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toMe(user: typeof users.$inferSelect): Me {
  return {
    id: user.id,
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    level: user.level,
    crowned: user.crowned,
  };
}

export async function createSession(
  db: DbClient,
  userId: string,
  now: Date,
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });
  return { token, tokenHash, expiresAt };
}

export interface ResolvedSession {
  tokenHash: string;
  user: Me;
  expiresAt: Date;
  /** True when the expiry was slid forward on this request (cookie must be re-issued). */
  renewed: boolean;
}

/** Look up a session by raw token; deletes expired ones, slides the expiry when < 15 days remain. */
export async function resolveSession(
  db: DbClient,
  token: string,
  now: Date,
): Promise<ResolvedSession | null> {
  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  if (!row) return null;

  if (row.session.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }

  let expiresAt = row.session.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - now.getTime() < SESSION_RENEW_BELOW_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    renewed = true;
    await db
      .update(sessions)
      .set({ expiresAt, lastSeenAt: now })
      .where(eq(sessions.id, row.session.id));
  }
  return { tokenHash, user: toMe(row.user), expiresAt, renewed };
}

export async function deleteSessionByHash(
  db: DbClient,
  tokenHash: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
