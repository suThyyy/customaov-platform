import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import pg from "pg";

import * as schema from "./schema.js";

export type DbClient = PgDatabase<PgQueryResultHKT, typeof schema>;

type DriverHandle =
  | { kind: "pg"; pool: pg.Pool; db: NodePgDatabase<typeof schema> }
  | { kind: "pglite"; client: PGlite; db: PgliteDatabase<typeof schema> };

const driverHandles = new WeakMap<object, DriverHandle>();

const DEFAULT_MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../database/migrations",
);

function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function isSpecialPgliteUrl(url: string): boolean {
  return url === "memory://" || url.startsWith("idb://");
}

/** Create a Drizzle database instance using `pg` for postgres:// URLs or PGlite otherwise. */
export function createDb(url: string): DbClient {
  if (isPostgresUrl(url)) {
    const pool = new pg.Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    driverHandles.set(db, { kind: "pg", pool, db });
    return db as unknown as DbClient;
  }

  if (!isSpecialPgliteUrl(url)) {
    mkdirSync(path.dirname(path.resolve(url)), { recursive: true });
  }
  const client = new PGlite(url);
  const db = drizzlePglite(client, { schema });
  driverHandles.set(db, { kind: "pglite", client, db });
  return db as unknown as DbClient;
}

/** Run Drizzle SQL migrations from `database/migrations/`. */
export async function migrate(
  db: DbClient,
  migrationsFolder: string = DEFAULT_MIGRATIONS_FOLDER,
): Promise<void> {
  const handle = driverHandles.get(db);
  if (handle?.kind === "pg") {
    await migratePg(handle.db, { migrationsFolder });
    return;
  }
  if (handle?.kind === "pglite") {
    await migratePglite(handle.db, { migrationsFolder });
    return;
  }
  throw new Error("Unsupported database instance passed to migrate()");
}

/** Close underlying pg Pool or PGlite client. */
export async function closeDb(db: DbClient): Promise<void> {
  const handle = driverHandles.get(db);
  if (!handle) return;
  if (handle.kind === "pg") {
    await handle.pool.end();
    return;
  }
  await handle.client.close();
}
