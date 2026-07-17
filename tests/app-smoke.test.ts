import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

process.env.APP_ENV = "testing";
process.env.APP_PORT = "4000";
process.env.DATABASE_URL = "postgresql://nexa_identity:nexa_identity@localhost:5432/nexa_identity?schema=public";
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-at-least-thirty-two-chars";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-at-least-thirty-two-chars";
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3000";

describe("app smoke", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { createApp } = await import("../src/app.js");
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP server address.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves health without authentication", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: "nexa-identity" });
  });

  it("serves the MVP account dashboard", async () => {
    const response = await fetch(`${baseUrl}/account`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Nexa Identity");
    expect(html).toContain("Data & Privacy");
  });
});
