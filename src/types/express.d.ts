import type { AuthenticatedPrincipal } from "../auth/types.js";
import type { AdminRoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
      admin?: {
        userId: string;
        role: AdminRoleName;
        permissions: string[];
        sessionId: string;
      };
      requestId?: string;
    }

    interface Locals {
      cspNonce: string;
    }
  }
}
