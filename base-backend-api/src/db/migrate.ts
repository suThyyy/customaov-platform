import { loadConfig } from "../config.js";
import { closeDb, createDb, migrate } from "./client.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

try {
  await migrate(db);
  console.log(`Migrations applied (${config.DATABASE_URL})`);
} finally {
  await closeDb(db);
}
