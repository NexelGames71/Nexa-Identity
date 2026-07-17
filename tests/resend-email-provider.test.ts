import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "../src/email/resend-email-provider.js";

describe("ResendEmailProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends email through Resend without exposing provider internals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const provider = new ResendEmailProvider("re_test_key", "Nexa <noreply@nexa.ai>");
    await expect(
      provider.send({
        to: "user@example.com",
        subject: "Verify your Nexa account",
        text: "Verification token"
      })
    ).resolves.toEqual({ providerMessageId: "email_123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("fails clearly when the API key is missing", async () => {
    const provider = new ResendEmailProvider("", "Nexa <noreply@nexa.ai>");

    await expect(
      provider.send({
        to: "user@example.com",
        subject: "Subject",
        text: "Body"
      })
    ).rejects.toThrow("RESEND_API_KEY is not configured.");
  });

  it("allows admin-triggered email to use an admin sender domain", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_admin_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const provider = new ResendEmailProvider("re_test_key", "Nexa <noreply@nexa.ai>");
    await provider.send({
      to: "user@example.com",
      from: "Nexa Admin <admin@admin.nexaidentity.com>",
      subject: "Admin email",
      text: "Admin email body"
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.from).toBe("Nexa Admin <admin@admin.nexaidentity.com>");
  });
});
