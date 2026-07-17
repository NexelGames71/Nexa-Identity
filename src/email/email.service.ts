import { env, identityBaseUrl } from "../config/env.js";
import { DevelopmentEmailProvider, DisabledEmailProvider, type EmailProvider } from "./email-provider.js";
import { ResendEmailProvider } from "./resend-email-provider.js";

function createEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "resend") {
    return new ResendEmailProvider(env.RESEND_API_KEY || env.EMAIL_PROVIDER_API_KEY, env.EMAIL_FROM);
  }

  if (env.EMAIL_PROVIDER === "disabled") {
    return new DisabledEmailProvider();
  }

  if (env.APP_ENV !== "production") {
    return new DevelopmentEmailProvider();
  }

  return new DisabledEmailProvider();
}

const provider = createEmailProvider();

export async function sendEmailVerification(params: { to: string; token: string; from?: string }) {
  return provider.send({
    to: params.to,
    from: params.from,
    subject: "Verify your Nexa account",
    text: `Verify your Nexa account: ${identityBaseUrl}/verify-email?token=${params.token}`
  });
}

export async function sendPasswordReset(params: { to: string; token: string; from?: string }) {
  return provider.send({
    to: params.to,
    from: params.from,
    subject: "Reset your Nexa password",
    text: `Reset your Nexa password using this token: ${params.token}`
  });
}

export async function sendOrganizationInvite(params: {
  to: string;
  from?: string;
  organizationName: string;
  token: string;
}) {
  return provider.send({
    to: params.to,
    from: params.from,
    subject: `You're invited to ${params.organizationName} on Nexa`,
    text: `Accept your Nexa organization invite using this token: ${params.token}`
  });
}

export async function sendBetaInvite(params: { to: string; from?: string; displayName?: string; inviteCode?: string }) {
  const greeting = params.displayName ? `Hi ${params.displayName},` : "Hi,";
  const inviteText = params.inviteCode ? ` Your invite code is ${params.inviteCode}.` : "";
  return provider.send({
    to: params.to,
    from: params.from,
    subject: "You're invited to the Nexa beta",
    text: `${greeting} you're invited to try the Nexa beta.${inviteText} Sign in at ${identityBaseUrl} to continue.`
  });
}
