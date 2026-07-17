# Admin API Reference

All admin API routes are under `/admin/api`. They require:

- `ADMIN_DASHBOARD_ENABLED=true`
- Allowed source IP
- Valid Nexa Identity admin session
- Backend RBAC permission

Current MVP routes:

| Method | Route | Permission |
| --- | --- | --- |
| `POST` | `/auth/login` | Active admin role |
| `POST` | `/auth/logout` | Active admin session |
| `GET` | `/auth/me` | Active admin session |
| `GET` | `/overview` | `admin.system.view` |
| `GET` | `/admins` | `admin.admins.manage` |
| `POST` | `/admins` | `admin.admins.manage` |
| `PATCH` | `/admins/:roleId` | `admin.admins.manage` |
| `POST` | `/admins/:roleId/revoke` | `admin.admins.manage` |
| `GET` | `/users` | `admin.users.view` |
| `GET` | `/users/:id` | `admin.users.view` |
| `PATCH` | `/users/:id` | `admin.users.update` |
| `POST` | `/users/:id/disable` | `admin.users.disable` |
| `POST` | `/users/:id/enable` | `admin.users.disable` |
| `GET` | `/users/:id/sessions` | `admin.sessions.view` |
| `POST` | `/users/:id/sessions/:sessionId/revoke` | `admin.sessions.revoke` |
| `POST` | `/users/:id/sessions/revoke-all` | `admin.sessions.revoke` |
| `GET` | `/users/:id/devices` | `admin.devices.view` |
| `GET` | `/users/:id/entitlements` | `admin.entitlements.view` |
| `POST` | `/users/:id/entitlements` | `admin.entitlements.update` |
| `PATCH` | `/users/:id/entitlements/:entitlementId` | `admin.entitlements.update` |
| `POST` | `/users/:id/entitlements/:entitlementId/disable` | `admin.entitlements.update` |
| `GET` | `/users/:id/permissions` | `admin.permissions.view` |
| `PATCH` | `/users/:id/permissions/:scope` | `admin.permissions.reset` |
| `POST` | `/users/:id/permissions/reset` | `admin.permissions.reset` |
| `GET` | `/users/:id/api-keys` | `admin.api_keys.view` |
| `GET` | `/beta/users` | `admin.beta.view` |
| `POST` | `/beta/users/:id/add` | `admin.beta.update` |
| `POST` | `/beta/users/:id/remove` | `admin.beta.update` |
| `POST` | `/beta/invites` | `admin.beta.update` |
| `POST` | `/email/:id/send-verification` | `admin.email.resend_verification` |
| `POST` | `/email/:id/send-password-reset` | `admin.email.send_password_reset` |
| `POST` | `/email/:id/send-beta-invite` | `admin.beta.update` |
| `GET` | `/audit-logs` | `admin.audit.view` |
| `GET` | `/api-keys` | `admin.api_keys.view` |
| `POST` | `/api-keys/:apiKeyId/revoke` | `admin.api_keys.revoke` |
| `GET` | `/organizations` | `admin.users.view` |
| `GET` | `/organizations/:id` | `admin.users.view` |
| `GET` | `/system/health` | `admin.system.view` |
| `GET` | `/settings` | `admin.system.view` |

Mutation routes that can affect user access require a `reason` field. The reason is stored in audit metadata.

Admin role management refuses to remove the last active owner.

Responses use the same envelope as the public API:

```json
{ "ok": true, "data": {} }
```

Errors:

```json
{ "ok": false, "error": { "code": "forbidden", "message": "Admin permission is required." } }
```
