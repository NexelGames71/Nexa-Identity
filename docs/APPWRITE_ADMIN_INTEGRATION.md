# Appwrite Admin Integration

The admin dashboard must not call Appwrite directly from the browser.

Rules:

- Appwrite endpoint, project ID, and API key stay server-side.
- The admin frontend calls Nexa Identity admin APIs only.
- Admin API responses must not include Appwrite API keys or provider secrets.
- Future Appwrite-specific code should sit behind repository or adapter boundaries so Nexa Identity can migrate storage without rewriting product clients.

Current implementation uses Prisma/PostgreSQL as the identity source of truth. Appwrite configuration is reported only as safe operational status in `/admin/api/system/health`.
