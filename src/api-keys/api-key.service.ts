import { nanoid } from "nanoid";
import { prisma } from "../config/database.js";
import { sha256 } from "../security/hash.js";

export function createPlainApiKey(appEnv: string) {
  const mode = appEnv === "production" ? "live" : "test";
  const secret = nanoid(48);
  return `nexa_sk_${mode}_${secret}`;
}

export function apiKeyPrefix(apiKey: string) {
  const match = /^(nexa_sk_(?:live|test))_(.{8})/.exec(apiKey);
  if (!match) {
    throw new Error("Invalid Nexa API key format.");
  }

  return `${match[1]}_${match[2]}`;
}

export async function createApiKey(params: {
  userId: string;
  organizationId?: string;
  name: string;
  scopes: string[];
  expiresAt?: Date;
  appEnv: string;
}) {
  const plainKey = createPlainApiKey(params.appEnv);
  const key = await prisma.apiKey.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      name: params.name,
      scopes: params.scopes,
      expiresAt: params.expiresAt,
      prefix: apiKeyPrefix(plainKey),
      keyHash: sha256(plainKey)
    }
  });

  return { apiKey: key, plainKey };
}

export async function verifyApiKey(params: { plainKey: string; requiredScopes?: string[] }) {
  const prefix = apiKeyPrefix(params.plainKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      prefix,
      keyHash: sha256(params.plainKey),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    include: {
      user: { select: { id: true, email: true, username: true, displayName: true, status: true } },
      organization: { select: { id: true, name: true, slug: true, status: true } }
    }
  });

  if (!apiKey) {
    return { valid: false as const, reason: "invalid_or_revoked" };
  }

  const missingScopes = (params.requiredScopes ?? []).filter((scope) => !apiKey.scopes.includes(scope));
  if (missingScopes.length > 0) {
    return { valid: false as const, reason: "missing_scopes", missingScopes };
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });

  return {
    valid: true as const,
    apiKey: {
      id: apiKey.id,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      user: apiKey.user,
      organization: apiKey.organization
    }
  };
}
