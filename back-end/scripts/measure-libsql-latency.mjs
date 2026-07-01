import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const env = {};
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, "..");

for (const file of [".env", ".dev.vars"]) {
  const envPath = path.join(backendDir, file);
  if (!fs.existsSync(envPath)) {
    continue;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) {
      continue;
    }
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const client = createClient({
  url: env.DATABASE_URL || env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

for (let index = 1; index <= 3; index += 1) {
  const startedAt = Date.now();
  await client.execute("SELECT 1");
  console.log(`select${index}=${Date.now() - startedAt}`);
}

const batchStartedAt = Date.now();
await client.batch(
  [
    { sql: "SELECT 1", args: [] },
    { sql: "SELECT 2", args: [] },
    { sql: "SELECT 3", args: [] },
  ],
  "read",
);
console.log(`batch3=${Date.now() - batchStartedAt}`);

client.close();
