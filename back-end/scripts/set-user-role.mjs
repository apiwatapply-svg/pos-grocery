import fs from "node:fs";
import { createClient } from "@libsql/client";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
    }
  }
}

loadEnvFile(".env");

const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const username = process.argv[2] || "admin";
const newRole = process.argv[3] || "admin";

const client = createClient({ url, authToken });

console.log(`Setting role="${newRole}" for user "${username}" on ${url}`);
const result = await client.execute({
  sql: "UPDATE User SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE username = ?",
  args: [newRole, username],
});

console.log(`Updated ${result.rowsAffected} row(s)`);

const verify = await client.execute({
  sql: "SELECT id, username, displayName, role, status FROM User WHERE username = ?",
  args: [username],
});

for (const row of verify.rows) {
  console.log("After update:", {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
  });
}
