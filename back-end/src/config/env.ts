import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

function loadLocalEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
    }
  }
}

function normalizeFileDatabaseUrl(key: string, baseDir: string) {
  const value = process.env[key];
  if (!value?.startsWith("file:")) {
    return;
  }

  const filePath = value.slice("file:".length);
  if (!filePath || path.isAbsolute(filePath)) {
    return;
  }

  process.env[key] = `file:${path.resolve(baseDir, filePath)}`;
}

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const backendRoot = path.resolve(currentDir, "..", "..");

if (process.env.NODE_ENV !== "production") {
  const cwd = process.cwd();
  const candidateDirs = new Set([backendRoot, cwd, path.join(cwd, "back-end")]);

  for (const dir of candidateDirs) {
    loadLocalEnvFile(path.join(dir, ".env"));
    loadLocalEnvFile(path.join(dir, ".dev.vars"));
  }
}

process.env.DATABASE_URL ??= "file:./dev.db";
process.env.PRISMA_DATABASE_URL ??= "file:./dev.db";
normalizeFileDatabaseUrl("DATABASE_URL", backendRoot);
normalizeFileDatabaseUrl("PRISMA_DATABASE_URL", backendRoot);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("pos-grocery"),
});

export const env = envSchema.parse(process.env);
