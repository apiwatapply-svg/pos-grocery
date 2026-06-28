import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { seedInitialAdmin } from "./modules/users/seed-admin.js";

async function startServer() {
  await seedInitialAdmin({
    adminUsername: env.ADMIN_USERNAME,
    adminPassword: env.ADMIN_PASSWORD,
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
