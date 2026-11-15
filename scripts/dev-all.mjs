import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "base-backend-api");
const requireFromApi = createRequire(path.join(apiDir, "package.json"));
const tsxLoaderUrl = pathToFileURL(requireFromApi.resolve("tsx")).href;

const apiHost = process.env.HOST ?? "127.0.0.1";
const apiPort = process.env.PORT ?? "6174";
const webPort = process.env.WEB_PORT ?? "5174";
const apiTarget = process.env.API_TARGET ?? `http://${apiHost}:${apiPort}`;
const allowedOrigins =
  process.env.ALLOWED_ORIGINS ??
  `http://localhost:${webPort},http://127.0.0.1:${webPort}`;
const databaseUrl = process.env.DATABASE_URL ?? "./.data/pglite";

const apiEnv = {
  ...process.env,
  HOST: apiHost,
  PORT: apiPort,
  DATABASE_URL: databaseUrl,
  ALLOWED_ORIGINS: allowedOrigins,
};

const webEnv = {
  ...process.env,
  VITE_DATA_SOURCE: "api",
  API_TARGET: apiTarget,
};

const seedCheckScript = `
import { count } from "drizzle-orm";
import { loadConfig } from "./src/config.js";
import { closeDb, createDb, formatDatabaseTarget, migrate } from "./src/db/client.js";
import { users } from "./src/db/schema.js";
import { seedDatabase } from "./src/db/seed.js";

(async () => {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  try {
    await migrate(db);
    const [{ total }] = await db.select({ total: count() }).from(users);
    if (Number(total) === 0 && config.NODE_ENV !== "production") {
      await seedDatabase(db, { nodeEnv: config.NODE_ENV });
      console.log("[dev:all] Seeded empty database (" + formatDatabaseTarget(config.DATABASE_URL) + ")");
    } else {
      console.log("[dev:all] Database ready (" + formatDatabaseTarget(config.DATABASE_URL) + ", users=" + total + ")");
    }
  } finally {
    await closeDb(db);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

console.log("[dev:all] Checking database & migrations...");
const seedResult = spawnSync(
  process.execPath,
  ["--import", tsxLoaderUrl, "--input-type=module", "-e", seedCheckScript],
  {
    cwd: apiDir,
    env: apiEnv,
    stdio: "inherit",
  },
);
if (seedResult.status !== 0) {
  process.exit(seedResult.status ?? 1);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";

console.log(`[dev:all] Starting API (${apiTarget}) and Web (http://localhost:${webPort}, VITE_DATA_SOURCE=api)...`);

const apiChild = spawn(npmCmd, ["run", "dev", "--workspace", "@customaov/api"], {
  cwd: rootDir,
  env: apiEnv,
  stdio: "inherit",
  shell: useShell,
});

const webArgs = ["run", "dev", "--workspace", "base-frontend-web"];
if (process.env.WEB_PORT) {
  webArgs.push("--", "--port", webPort);
}

const webChild = spawn(npmCmd, webArgs, {
  cwd: rootDir,
  env: webEnv,
  stdio: "inherit",
  shell: useShell,
});

const children = [apiChild, webChild];
let shuttingDown = false;
let exitedCount = 0;

function terminateChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    terminateChild(child);
  }
  setTimeout(() => process.exit(exitCode), 3000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n[dev:all] Received ${signal}, stopping API and Web...`);
    shutdown(0);
  });
}

for (const [name, child] of [
  ["api", apiChild],
  ["web", webChild],
]) {
  child.on("exit", (code, signal) => {
    exitedCount += 1;
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 1}`;
      console.error(`[dev:all] ${name} exited unexpectedly (${reason}). Stopping remaining processes...`);
      shutdown(code && code !== 0 ? code : 1);
      return;
    }
    if (exitedCount === children.length) {
      process.exit(process.exitCode ?? 0);
    }
  });
}
