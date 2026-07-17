import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { prisma } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { sendError } from "../utils/api-response.js";
import { acceptOrganizationInvite, createOrganizationInvite } from "./organization-invite.service.js";
import { isProduction } from "../config/env.js";
import { sendOrganizationInvite } from "../email/email.service.js";

export const organizationRouter = Router();
organizationRouter.use(authenticate);

organizationRouter.post(
  "/organizations",
  validateBody(
    z.object({
      name: z.string().min(1).max(120),
      slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/)
    })
  ),
  asyncHandler(async (req, res) => {
    const organization = await prisma.organization.create({
      data: {
        name: req.body.name,
        slug: req.body.slug,
        ownerUserId: req.principal!.userId,
        members: { create: { userId: req.principal!.userId, role: "owner" } }
      },
      include: { members: true }
    });
    await auditLog({ req, userId: req.principal!.userId, organizationId: organization.id, action: "organization.created", resourceType: "organization", resourceId: organization.id });
    return sendSuccess(res, { organization }, 201);
  })
);

organizationRouter.get(
  "/organizations",
  asyncHandler(async (req, res) => {
    const organizations = await prisma.organization.findMany({
      where: { members: { some: { userId: req.principal!.userId, status: "active" } } },
      include: { members: true },
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { organizations });
  })
);

organizationRouter.get(
  "/organizations/:organizationId/members",
  validateParams(z.object({ organizationId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const organizationId = String(req.params.organizationId);
    const members = await prisma.organizationMember.findMany({
      where: { organizationId, organization: { members: { some: { userId: req.principal!.userId } } } },
      include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } } }
    });
    return sendSuccess(res, { members });
  })
);

organizationRouter.post(
  "/organizations/:organizationId/switch",
  validateParams(z.object({ organizationId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const organizationId = String(req.params.organizationId);
    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        id: organizationId,
        members: { some: { userId: req.principal!.userId, status: "active" } }
      }
    });
    await auditLog({ req, userId: req.principal!.userId, organizationId, action: "organization.switched", resourceType: "organization", resourceId: organizationId });
    return sendSuccess(res, { activeOrganization: organization });
  })
);

organizationRouter.post(
  "/organizations/:organizationId/invites",
  validateParams(z.object({ organizationId: z.string().min(1) })),
  validateBody(z.object({ email: z.string().email(), role: z.enum(["admin", "developer", "viewer"]) })),
  asyncHandler(async (req, res) => {
    try {
      const { invite, token } = await createOrganizationInvite({
        organizationId: String(req.params.organizationId),
        invitedByUserId: req.principal!.userId,
        email: req.body.email,
        role: req.body.role
      });
      await auditLog({
        req,
        userId: req.principal!.userId,
        organizationId: invite.organizationId,
        action: "organization.invite_created",
        resourceType: "organization_invite",
        resourceId: invite.id,
        metadata: { email: invite.email, role: invite.role }
      });
      await sendOrganizationInvite({
        to: invite.email,
        organizationName: invite.organization.name,
        token
      });

      return sendSuccess(res, { invite, inviteToken: isProduction ? undefined : token }, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes("admin access")) {
        return sendError(res, 403, "forbidden", "Organization admin access is required.");
      }
      throw error;
    }
  })
);

organizationRouter.post(
  "/organizations/invites/accept",
  validateBody(z.object({ token: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    try {
      const membership = await acceptOrganizationInvite({
        token: req.body.token,
        userId: req.principal!.userId
      });

      if (!membership) {
        return sendError(res, 400, "bad_request", "Organization invite is invalid or expired.");
      }

      await auditLog({
        req,
        userId: req.principal!.userId,
        organizationId: membership.organizationId,
        action: "organization.invite_accepted",
        resourceType: "organization_member",
        resourceId: membership.id
      });
      return sendSuccess(res, { membership });
    } catch (error) {
      if (error instanceof Error && error.message.includes("email does not match")) {
        return sendError(res, 403, "forbidden", "Invite email does not match the authenticated user.");
      }
      throw error;
    }
  })
);
