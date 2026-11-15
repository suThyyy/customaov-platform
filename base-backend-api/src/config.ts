import { randomBytes } from "node:crypto";
import { z } from "zod";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5174", "http://localhost:5173"];

const configSchema = z
  .object({
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(6174),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().trim().min(1).optional(),
    CSRF_SECRET: z.string().min(16).optional(),
    ALLOWED_ORIGINS: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.CSRF_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["CSRF_SECRET"],
        message: "is required in production (min 16 characters)",
      });
    }
  })
  .transform((data) => ({
    ...data,
    DATABASE_URL:
      data.DATABASE_URL ??
      (data.NODE_ENV === "test" ? "memory://" : "./.data/pglite"),
    // Dev/test: random secret generated at startup (sessions' CSRF tokens reset on restart).
    CSRF_SECRET: data.CSRF_SECRET ?? randomBytes(32).toString("hex"),
    ALLOWED_ORIGINS: data.ALLOWED_ORIGINS
      ? data.ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      : DEFAULT_ALLOWED_ORIGINS,
  }));

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}

