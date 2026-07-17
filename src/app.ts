import cookieParser from "cookie-parser";
import cors from "cors";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import express from "express";
import type helmetDefault from "helmet";
import { adminRouter } from "./admin/admin.routes.js";
import { requireAdminDashboardAccess } from "./admin/middleware/admin-local-access.js";
import { adminApiRouter } from "./admin/routes/admin-api.routes.js";
import { adminAuthRouter } from "./admin/routes/admin-auth.routes.js";
import { adminDashboardRouter } from "./admin/routes/admin-dashboard.routes.js";
import { apiKeyRouter } from "./api-keys/api-key.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import { effectiveCorsAllowedOrigins, isProduction } from "./config/env.js";
import { deviceRouter } from "./devices/device.routes.js";
import { dashboardRouter } from "./dashboard/dashboard.routes.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { integrationRouter } from "./integrations/integration.routes.js";
import { identityUiRouter } from "./identity-ui/identity-ui.routes.js";
import { requestId } from "./middleware/request-id.js";
import { entitlementRouter } from "./products/entitlement.routes.js";
import { adminAuthRateLimit, authRateLimit, generalRateLimit } from "./security/rate-limit.js";
import { organizationRouter } from "./organizations/organization.routes.js";
import { permissionRouter } from "./permissions/permission.routes.js";
import { privacyRouter } from "./privacy/privacy.routes.js";
import { sessionRouter } from "./sessions/session.routes.js";
import { subscriptionRouter } from "./subscriptions/subscription.routes.js";
import { systemRouter } from "./system/system.routes.js";

const require = createRequire(import.meta.url);
const helmet = require("helmet") as typeof helmetDefault;

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (isProduction) {
    app.set("trust proxy", 1);
  }
  app.use(requestId);
  app.use((_req, res, next) => {
    res.locals.cspNonce = randomBytes(16).toString("base64");
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: [
            "'self'",
            (_req: IncomingMessage, res: ServerResponse) =>
              `'nonce-${(res as express.Response).locals.cspNonce}'`
          ],
          scriptSrcAttr: ["'unsafe-inline'"]
        }
      }
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || effectiveCorsAllowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin is not allowed."));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(generalRateLimit);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nexa-identity", production: isProduction });
  });
  app.use(identityUiRouter);
  app.use(systemRouter);

  app.use(dashboardRouter);
  app.use("/v1/auth", authRateLimit, authRouter);
  app.use("/v1", sessionRouter);
  app.use("/v1", deviceRouter);
  app.use("/v1", permissionRouter);
  app.use("/v1", privacyRouter);
  app.use("/v1", entitlementRouter);
  app.use("/v1", subscriptionRouter);
  app.use("/v1", apiKeyRouter);
  app.use("/v1", organizationRouter);
  app.use("/v1", integrationRouter);
  app.use("/v1/admin", adminRouter);
  app.use("/admin", requireAdminDashboardAccess);
  app.use("/admin/api/auth/login", adminAuthRateLimit);
  app.use("/admin/api", adminAuthRouter);
  app.use("/admin/api", adminApiRouter);
  app.use(adminDashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
