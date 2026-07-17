export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  text: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class DevelopmentEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (process.env.APP_ENV === "production") {
      throw new Error("Development email provider cannot send in production.");
    }

    console.info("[nexa-email:development]", {
      to: message.to,
      from: message.from,
      subject: message.subject,
      text: "[redacted]"
    });
    return {};
  }
}

export class DisabledEmailProvider implements EmailProvider {
  async send(): Promise<EmailSendResult> {
    return {};
  }
}

export class EmailProviderError extends Error {
  constructor(message = "Email provider request failed.") {
    super(message);
    this.name = "EmailProviderError";
  }
}
