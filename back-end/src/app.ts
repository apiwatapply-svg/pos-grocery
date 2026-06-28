import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createInventoryRouter } from "./modules/inventory/inventory.routes.js";
import { createProductRouter } from "./modules/products/product.routes.js";
import { createReportRouter } from "./modules/reports/report.routes.js";
import { createSaleRouter } from "./modules/sales/sale.routes.js";
import { createStoreRouter } from "./modules/stores/store.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { defaultUserRepository, type UserRepository } from "./modules/users/user.repository.js";
import { errorMiddleware } from "./shared/errors/error.middleware.js";
import { healthRouter } from "./shared/http/health.routes.js";
import { notFoundMiddleware } from "./shared/middleware/not-found.middleware.js";

export function createApp(deps?: {
  repository?: UserRepository;
  jwtSecret?: string;
}) {
  const app = express();
  const repository = deps?.repository ?? defaultUserRepository;
  const jwtSecret = deps?.jwtSecret;

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

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
