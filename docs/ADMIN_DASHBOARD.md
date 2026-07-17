# Admin Dashboard

The admin dashboard is an internal Nexa Labs control panel. It is separate from the public account dashboard.

Current foundation:

- Admin env configuration.
- Admin role and session models.
- Owner bootstrap command.
- IAM-based admin login API.
- RBAC permission service.
- Local/IP access gate for `/admin`.
- Internal admin UI at `/admin`.
- Protected admin API routes for overview, users, sessions, devices, entitlements, permissions, beta access, email tools, audit logs, API keys, organizations, system health, and settings.

The dashboard should remain local-first and disabled unless `ADMIN_DASHBOARD_ENABLED=true`.

## Local URL

Start the identity API and open:

```text
http://127.0.0.1:4000/admin
```

The dashboard is served by the identity API process for the MVP. `ADMIN_DASHBOARD_HOST` and `ADMIN_DASHBOARD_PORT` are reserved for a future split admin server.

## API Surface

All routes below require `ADMIN_DASHBOARD_ENABLED=true`, an allowed source IP, a valid admin session, and backend RBAC:

- `POST /admin/api/auth/login`
- `POST /admin/api/auth/logout`
- `GET /admin/api/auth/me`
- `GET /admin/api/overview`
- `GET /admin/api/admins`
- `POST /admin/api/admins`
- `PATCH /admin/api/admins/:roleId`
- `POST /admin/api/admins/:roleId/revoke`
- `GET /admin/api/users`
- `GET /admin/api/users/:id`
- `PATCH /admin/api/users/:id`
- `POST /admin/api/users/:id/disable`
- `POST /admin/api/users/:id/enable`
- `GET /admin/api/users/:id/sessions`
- `POST /admin/api/users/:id/sessions/:sessionId/revoke`
- `POST /admin/api/users/:id/sessions/revoke-all`
- `GET /admin/api/users/:id/devices`
- `GET /admin/api/users/:id/entitlements`
- `POST /admin/api/users/:id/entitlements`
- `PATCH /admin/api/users/:id/entitlements/:entitlementId`
- `POST /admin/api/users/:id/entitlements/:entitlementId/disable`
- `GET /admin/api/users/:id/permissions`
- `PATCH /admin/api/users/:id/permissions/:scope`
- `POST /admin/api/users/:id/permissions/reset`
- `GET /admin/api/users/:id/api-keys`
- `GET /admin/api/beta/users`
- `POST /admin/api/beta/users/:id/add`
- `POST /admin/api/beta/users/:id/remove`
- `POST /admin/api/beta/invites`
- `POST /admin/api/email/:id/send-verification`
- `POST /admin/api/email/:id/send-password-reset`
- `POST /admin/api/email/:id/send-beta-invite`
- `GET /admin/api/audit-logs`
- `GET /admin/api/api-keys`
- `POST /admin/api/api-keys/:apiKeyId/revoke`
- `GET /admin/api/organizations`
- `GET /admin/api/organizations/:id`
- `GET /admin/api/system/health`
- `GET /admin/api/settings`

The UI and API never expose password hashes, refresh token hashes, raw API keys, Appwrite keys, email provider keys, or billing secrets.

Admin role management is owner-only through `admin.admins.manage`. Revoking an admin role also revokes that user’s active admin sessions.
