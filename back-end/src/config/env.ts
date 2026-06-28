import fs from "node:fs";
import path from "node:path";
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

if (process.env.NODE_ENV !== "production") {
  const cwd = process.cwd();
  loadLocalEnvFile(path.join(cwd, ".env"));
  loadLocalEnvFile(path.join(cwd, ".dev.vars"));
  loadLocalEnvFile(path.join(cwd, "back-end", ".env"));
  loadLocalEnvFile(path.join(cwd, "back-end", ".dev.vars"));
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("admin"),
  TURSO_AUTH_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("pos-grocery/products"),
});

export const env = envSchema.parse(process.env);
