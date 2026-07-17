import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../config/database.js";
import { corsAllowedOrigins, env, identityBaseUrl } from "../config/env.js";
import { sha256 } from "../security/hash.js";
import { getUserEntitlements } from "../products/entitlement.service.js";
import { presentUser } from "../users/user.presenter.js";
import { createTokenSession } from "./auth.service.js";
import type { Request } from "express";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CLIENT_ID = "nexa-web";

function configuredWebOrigins() {
  const values = [
    process.env.NEXA_WEB_URL,
    process.env.NEXT_PUBLIC_NEXA_WEB_URL,
    "https://trynexa-ai.com",
    "https://www.trynexa-ai.com",
    ...corsAllowedOrigins
  ].filter(Boolean) as string[];

  if (env.APP_ENV !== "production") {
    values.push("http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001");
  }

  return Array.from(new Set(values.map((value) => value.replace(/\/$/, ""))));
}

export function getAllowedAuthClient(clientId = DEFAULT_CLIENT_ID) {
  if (clientId !== DEFAULT_CLIENT_ID) {
    throw new Error("Unknown Nexa Identity client.");
  }

  return {
    clientId: DEFAULT_CLIENT_ID,
    allowedOrigins: configuredWebOrigins()
  };
}

function sameOrigin(url: URL, origin: string) {
  try {
    return timingSafeEqual(Buffer.from(url.origin), Buffer.from(new URL(origin).origin));
  } catch {
    return false;
  }
}

export function validateClientUrl(value: string, clientId = DEFAULT_CLIENT_ID) {
  const parsed = new URL(value);
  const client = getAllowedAuthClient(clientId);
  if (!client.allowedOrigins.some((origin) => sameOrigin(parsed, origin))) {
    throw new Error("Redirect URL is not allowed for this Nexa client.");
  }
  return parsed.toString();
}

export function defaultRedirectUri(clientId = DEFAULT_CLIENT_ID) {
  const client = getAllowedAuthClient(clientId);
  return `${client.allowedOrigins[0]}/auth/callback`;
}

export async function issueAuthCode(params: {
  userId: string;
  clientId?: string;
  redirectUri: string;
  returnTo: string;
}) {
  const clientId = params.clientId || DEFAULT_CLIENT_ID;
  const redirectUri = validateClientUrl(params.redirectUri, clientId);
  const returnTo = validateClientUrl(params.returnTo, clientId);
  const code = randomBytes(32).toString("base64url");

  await prisma.authCode.create({
    data: {
      codeHash: sha256(code),
      userId: params.userId,
      clientId,
      redirectUri,
      returnTo,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS)
    }
  });

  return { code, redirectUri, returnTo, expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS) };
}

export async function exchangeAuthCode(params: {
  code: string;
  clientId?: string;
  redirectUri: string;
  req?: Request;
}) {
  const clientId = params.clientId || DEFAULT_CLIENT_ID;
  const redirectUri = validateClientUrl(params.redirectUri, clientId);
  const codeHash = sha256(params.code);
  const now = new Date();

  const authCode = await prisma.authCode.findUnique({
    where: { codeHash },
    include: { user: { include: { profile: true } } }
  });

  if (!authCode || authCode.clientId !== clientId || authCode.redirectUri !== redirectUri || authCode.usedAt || authCode.expiresAt <= now) {
    throw new Error("Authorization code is invalid or expired.");
  }

  await prisma.authCode.update({
    where: { id: authCode.id },
    data: { usedAt: now }
  });

  const tokens = await createTokenSession({
    user: authCode.user,
    req: params.req,
    device: {
      deviceName: "Nexa Web",
      deviceType: "browser",
      platform: params.req?.get("sec-ch-ua-platform") || "web",
      browser: params.req?.get("user-agent") || "web"
    }
  });

  return {
    tokens,
    user: presentUser(authCode.user),
    entitlements: await getUserEntitlements(authCode.user.id),
    returnTo: authCode.returnTo,
    issuer: identityBaseUrl
  };
}
