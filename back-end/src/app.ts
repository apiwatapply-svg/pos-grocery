import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthRouter } from "./modules/auth/auth.routes.ts";
import { createInventoryRouter } from "./modules/inventory/inventory.routes.ts";
import { createProductRouter } from "./modules/products/product.routes.ts";
import { createReportRouter } from "./modules/reports/report.routes.ts";
import { createSaleRouter } from "./modules/sales/sale.routes.ts";
import { createStoreRouter } from "./modules/stores/store.routes.ts";
import { createUserRouter } from "./modules/users/user.routes.ts";
import { defaultUserRepository, type UserRepository } from "./modules/users/user.repository.ts";
import { errorMiddleware } from "./shared/errors/error.middleware.ts";
import { healthRouter } from "./shared/http/health.routes.ts";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.ts";
import { clearReadCacheOnMutationMiddleware } from "./shared/middleware/read-cache.middleware.ts";

export function createApp(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const app = express();
  const repository = deps?.repository ?? defaultUserRepository;
  const jwtSecret = deps?.jwtSecret;

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(clearReadCacheOnMutationMiddleware());

  app.use("/api", healthRouter);
  app.use("/api/auth", createAuthRouter({ repository, jwtSecret }));
  app.use("/api/store", createStoreRouter({ repository, jwtSecret }));
  app.use("/api/users", createUserRouter({ repository, jwtSecret }));
  app.use("/api/products", createProductRouter({ repository, jwtSecret }));
  app.use("/api/inventory", createInventoryRouter({ repository, jwtSecret }));
  app.use("/api/sales", createSaleRouter({ repository, jwtSecret }));
  app.use("/api/reports", createReportRouter({ repository, jwtSecret }));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
