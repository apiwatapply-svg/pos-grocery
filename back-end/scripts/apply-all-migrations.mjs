import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

function loadEnvFile(filePath) {
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

loadEnvFile(".env");

const useLocalFile = process.argv.includes("--local");
const url = useLocalFile
  ? process.env.PRISMA_DATABASE_URL || "file:./dev.db"
  : process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationsDir = path.join("prisma", "migrations");
const dirs = fs
  .readdirSync(migrationsDir)
  .filter((d) => /^\d+/.test(d))
  .sort();

const target = url.startsWith("file:") ? "local file database" : "Turso";
console.log(`Applying ${dirs.length} migrations to ${target} (${url})`);

const client = createClient({ url, authToken });

for (const dir of dirs) {
  const sqlPath = path.join(migrationsDir, dir, "migration.sql");
  if (!fs.existsSync(sqlPath)) {
    console.warn(`- Skipping ${dir}: no migration.sql`);
    continue;
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  process.stdout.write(`- ${dir} ... `);
  try {
    await client.executeMultiple(sql);
    console.log("ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Some migrations add columns that already exist when re-running.
    if (/already exists|duplicate column/i.test(message)) {
      console.log(`skipped (${message.split("\n")[0]})`);
      continue;
    }
    console.error(`failed: ${message}`);
    process.exit(1);
  }
}

console.log("All migrations applied successfully");
