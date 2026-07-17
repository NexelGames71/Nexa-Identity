import type { Request } from "express";
import { prisma } from "../config/database.js";
import { redactMetadata } from "../utils/redact.js";

export async function auditLog(params: {
  req?: Request;
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      ipAddress: params.req?.ip,
      userAgent: params.req?.get("user-agent"),
      metadata: (redactMetadata(params.metadata ?? {}) ?? {}) as object
    }
  });
}
