# API Reference

Base path: `/v1`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/verify-token`
- `POST /auth/verify-email`
- `POST /auth/change-password`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `PATCH /auth/profile`

## Account

- `GET /sessions`
- `DELETE /sessions/:sessionId`
- `DELETE /sessions`
- `GET /devices`
- `PATCH /devices/:deviceId`
- `GET /permissions`
- `PUT /permissions`
- `DELETE /permissions/:scope`
- `POST /permissions/check`
- `GET /entitlements`
- `POST /entitlements/check-feature`
- `GET /plans`
- `GET /billing/readiness`
- `GET /ready`
- `GET /subscriptions`
- `POST /subscriptions/checkout`
- `POST /subscriptions/:subscriptionId/cancel`
- `GET /privacy/export`
- `POST /privacy/disable-ai-data-use`
- `POST /privacy/delete-account-request`

## Platform

- `POST /api-keys`
- `GET /api-keys`
- `POST /api-keys/verify`
- `PATCH /api-keys/:apiKeyId`
- `DELETE /api-keys/:apiKeyId`
- `POST /organizations`
- `GET /organizations`
- `GET /organizations/:organizationId/members`
- `POST /organizations/:organizationId/switch`
- `POST /organizations/:organizationId/invites`
- `POST /organizations/invites/accept`

## Admin

Admin routes require an authenticated user with `role = admin`.

- `GET /admin/users`
- `GET /admin/users/:userId/entitlements`
- `PATCH /admin/users/:userId/status`
- `PUT /admin/users/:userId/entitlements`
- `POST /admin/users/:userId/subscriptions/manual`
- `GET /admin/sessions`
- `GET /admin/audit-logs`
- `GET /admin/account-deletion-requests`
- `PATCH /admin/account-deletion-requests/:requestId`
- `DELETE /admin/sessions/:sessionId`

## Dashboard

- `GET /account`

The dashboard is an MVP account surface that uses the same API endpoints with a bearer token.

## Product Integrations

- `GET /integrations/browser/bootstrap`
- `GET /integrations/nexa-ai/context`

These endpoints let Nexa Browser and Nexa AI consume identity, entitlement, permission, and capability state without owning user accounts.

See `docs/CODEX_SERVICE_INTEGRATION_GUIDE.md` for end-to-end integration instructions for Codex agents and product services.
