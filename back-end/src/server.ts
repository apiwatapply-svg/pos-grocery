import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { seedInitialAdmin } from "./modules/users/seed-admin.ts";

async function startServer() {
  await seedInitialAdmin({
    adminUsername: "admin",
    adminPassword: "admin",
    storeName: "POS Grocery",
  });

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`POS Grocery API listening on port ${env.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
