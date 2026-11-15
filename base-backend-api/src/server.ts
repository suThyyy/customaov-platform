import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { closeDb, createDb, migrate } from "./db/client.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
if (config.NODE_ENV !== "production") {
  await migrate(db);
}
const app = buildApp({ config, db });

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info({ signal }, "Shutting down");
  try {
    await app.close();
    await closeDb(db);
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error }, "Graceful shutdown failed");
    process.exitCode = 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error({ err: error }, "Failed to start server");
  process.exitCode = 1;
}
