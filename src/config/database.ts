import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

function getPrismaDatabaseUrl() {
  try {
    const url = new URL(env.DATABASE_URL);
    const hostname = url.hostname.toLowerCase();

    if (hostname.endsWith(".pooler.supabase.com") || hostname.includes("pooler.supabase.com")) {
      if (!url.searchParams.has("pgbouncer")) {
        url.searchParams.set("pgbouncer", "true");
      }
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
    }

    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

export const prisma = new PrismaClient({
  log: env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  datasources: {
    db: {
      url: getPrismaDatabaseUrl()
    }
  }
});
