import type { EmailMessage, EmailProvider, EmailSendResult } from "./email-provider.js";
import { EmailProviderError } from "./email-provider.js";

interface ResendEmailResponse {
  id?: string;
  message?: string;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.apiKey) {
      throw new EmailProviderError("RESEND_API_KEY is not configured.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: message.from ?? this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text
      })
    });

    const body = (await response.json().catch(() => ({}))) as ResendEmailResponse;
    if (!response.ok) {
      throw new EmailProviderError(body.message ?? `Resend request failed with status ${response.status}.`);
    }

    return { providerMessageId: body.id };
  }
}
