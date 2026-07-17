# Codex Service Integration Guide

This guide is for a Codex agent integrating Nexa Identity into a Nexa platform or application.

Nexa Identity is the source of truth for accounts, authentication, sessions, devices, permissions, product entitlements, subscriptions, API keys, organizations, and audit-sensitive account state. Product services must not create their own user/account authority.

Production base URL:

```text
https://identity.trynexa-ai.com
```

Local base URL:

```text
http://127.0.0.1:4000
```

All product APIs should use `/v1` unless noted otherwise.

## Agent Rules

When integrating a service:

- Do not duplicate Nexa Identity user tables in product databases.
- Do not store raw passwords, refresh tokens, API keys, or admin session tokens in product services.
- Do not call admin dashboard APIs from product services.
- Do not expose Nexa Identity secrets to frontend code.
- Validate every incoming bearer token, session cookie, or API key before trusting identity context.
- Cache identity context only briefly and invalidate it on auth failures, logout, permission denial, or subscription changes.
- Treat permissions and entitlements as separate systems:
  - Permissions are user/privacy/security consent.
  - Entitlements are product/plan access.
- Require explicit user approval for high-risk browser or account actions even if permissions allow the capability.

## Integration Patterns

Use one of these patterns per service surface.

| Surface | Recommended identity pattern |
| --- | --- |
| Web app frontend | Browser redirects/login against Nexa Identity, then uses HttpOnly cookies or received tokens. |
| Native/browser shell | Store access/refresh tokens in secure local storage and call `/v1/auth/refresh`. |
| Product backend | Accept bearer access token from client and call `/v1/auth/verify-token` or `/v1/auth/me`. |
| Machine/API access | Accept `nexa_sk_live_...` API key and call `/v1/api-keys/verify`. |
| Nexa AI | Use `/v1/integrations/nexa-ai/context`. |
| Nexa Browser | Use `/v1/integrations/browser/bootstrap`. |
| Cloud/team services | Use `/v1/auth/me`, `/v1/organizations`, `/v1/entitlements`, and `/v1/api-keys/verify`. |

## Required Environment Variables In Product Services

Each product service should define:

```env
NEXA_IDENTITY_BASE_URL=https://identity.trynexa-ai.com
NEXA_IDENTITY_API_TIMEOUT_MS=5000
```

Optional, only if the service validates JWTs locally:

```env
NEXA_IDENTITY_JWT_ACCESS_SECRET=<same signing secret from secret manager>
```

Prefer calling Nexa Identity for validation unless the service is latency-sensitive and has a secure secret distribution path.

## User Auth Flow

Registration:

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "nexa.user",
  "password": "long-password",
  "displayName": "Nexa User"
}
```

Login:

```http
POST /v1/auth/login
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "long-password",
  "deviceName": "Nexa Browser",
  "deviceType": "desktop",
  "platform": "Windows",
  "browser": "Nexa Browser"
}
```

The response includes access/refresh tokens and also sets HttpOnly cookies for browser flows.

Refresh:

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh token>"
}
```

Current account:

```http
GET /v1/auth/me
Authorization: Bearer <access token>
```

Token verification:

```http
POST /v1/auth/verify-token
Authorization: Bearer <access token>
```

Logout:

```http
POST /v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "<refresh token>"
}
```

## Product Bootstrap Calls

### Nexa AI

Use this endpoint after the user is authenticated:

```http
GET /v1/integrations/nexa-ai/context
Authorization: Bearer <access token>
```

Use the response to decide:

- whether memory can run
- whether training opt-in is enabled
- which plan and model tier is available
- which AI features are enabled
- whether the user is authenticated or degraded to guest mode

Required rules:

- Do not enable memory unless `ai.memory_enabled` is true.
- Do not use training data unless `ai.training_opt_in` is true.
- Do not infer plan access from frontend state; use entitlements.

### Nexa Browser

Use this endpoint during signed-in browser startup:

```http
GET /v1/integrations/browser/bootstrap
Authorization: Bearer <access token>
```

Use the response to decide:

- active account
- synced devices/session controls
- browser automation permissions
- safe browsing/guardian permissions
- product entitlement for Nexa Browser

High-risk browser actions still require explicit user approval:

- submitting forms
- payments/purchases
- sending messages
- deleting data
- changing account settings
- password/security changes

## Permission Checks

Permissions are privacy/security controls.

List permissions:

```http
GET /v1/permissions
Authorization: Bearer <access token>
```

Check a permission:

```http
POST /v1/permissions/check
Authorization: Bearer <access token>
Content-Type: application/json

{
  "scope": "browser.read_current_page"
}
```

Known permission scopes:

```text
browser.read_current_page
browser.read_all_tabs
browser.open_tabs
browser.close_tabs
browser.navigate
browser.read_history
browser.read_bookmarks
browser.manage_downloads
ai.memory_enabled
ai.training_opt_in
email.read
email.draft
email.send
cloud.storage.read
cloud.storage.write
cloud.database.read
cloud.database.write
guardian.scan_links
guardian.block_risky_sites
guardian.private_route_recommendations
```

Implementation rule:

```ts
if (!permission.allowed) {
  return deny("Permission is not enabled for this user.");
}
```

Do not silently enable permissions from product services. Sensitive permission changes should be user-driven or admin-audited in Nexa Identity.

## Entitlement Checks

Entitlements are product/plan access.

List entitlements:

```http
GET /v1/entitlements
Authorization: Bearer <access token>
```

Check a feature:

```http
POST /v1/entitlements/check-feature
Authorization: Bearer <access token>
Content-Type: application/json

{
  "productId": "nexa_ai",
  "feature": "advanced_models"
}
```

Product IDs:

```text
nexa_ai
nexa_browser
nexa_cloud
nexa_storage
nexa_database
nexa_ide
nexa_gpu
```

Plan IDs:

```text
free
plus
pro
premium
business
beta
internal
disabled
```

Implementation rule:

```ts
if (!feature.allowed) {
  return deny("Upgrade or product access required.");
}
```

Do not use permissions as a billing substitute. Do not use entitlements as user consent.

## API Key Integration

Services that accept machine/API access should validate Nexa API keys through Identity.

API key format:

```text
nexa_sk_live_<secret>
nexa_sk_test_<secret>
```

Verification:

```http
POST /v1/api-keys/verify
Content-Type: application/json

{
  "apiKey": "nexa_sk_live_...",
  "requiredScopes": ["storage.read"]
}
```

Successful response includes:

- API key ID
- prefix
- scopes
- owning user
- organization if attached

Service rule:

```ts
const result = await verifyApiKey(apiKey, ["storage.read"]);
if (!result.valid) {
  return deny("Invalid, revoked, expired, or underscoped API key.");
}
```

Never log raw API keys. Log only the returned prefix or ID.

## Organizations

Team-aware products should use organization endpoints rather than storing their own membership authority:

```http
POST /v1/organizations
GET /v1/organizations
GET /v1/organizations/:organizationId/members
POST /v1/organizations/:organizationId/switch
POST /v1/organizations/:organizationId/invites
POST /v1/organizations/invites/accept
```

Product services may store product-specific resources keyed by:

- `userId`
- `organizationId`
- product resource ID

They should not store passwords, Identity roles, raw tokens, or billing authority.

## Billing And Subscription Access

Plan discovery:

```http
GET /v1/plans
```

Billing readiness:

```http
GET /v1/billing/readiness
```

User subscriptions:

```http
GET /v1/subscriptions
Authorization: Bearer <access token>
```

Checkout:

```http
POST /v1/subscriptions/checkout
Authorization: Bearer <access token>
Content-Type: application/json

{
  "planId": "pro",
  "successUrl": "https://your-app.example/success",
  "cancelUrl": "https://your-app.example/cancel"
}
```

Product services should not directly call PayPal for account authority. PayPal integration belongs behind Nexa Identity billing services.

## Service Middleware Template

Use this shape in product backends.

```ts
interface NexaIdentityPrincipal {
  userId: string;
  email: string;
  username: string;
  role: string;
}

async function requireNexaUser(req, res, next) {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  if (!token) {
    return res.status(401).json({ ok: false, error: { code: "unauthorized", message: "Nexa login required." } });
  }

  const response = await fetch(`${process.env.NEXA_IDENTITY_BASE_URL}/v1/auth/verify-token`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    return res.status(401).json({ ok: false, error: { code: "unauthorized", message: "Nexa session is invalid." } });
  }

  req.nexaUser = body.data.principal as NexaIdentityPrincipal;
  return next();
}
```

Feature gate template:

```ts
async function requireNexaFeature(userToken: string, productId: string, feature: string) {
  const response = await fetch(`${process.env.NEXA_IDENTITY_BASE_URL}/v1/entitlements/check-feature`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ productId, feature })
  });
  const body = await response.json();
  return Boolean(response.ok && body.ok && body.data.allowed);
}
```

Permission gate template:

```ts
async function requireNexaPermission(userToken: string, scope: string) {
  const response = await fetch(`${process.env.NEXA_IDENTITY_BASE_URL}/v1/permissions/check`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ scope })
  });
  const body = await response.json();
  return Boolean(response.ok && body.ok && body.data.allowed);
}
```

## Nexa AI Implementation Checklist

1. Add `NEXA_IDENTITY_BASE_URL`.
2. Add auth middleware that validates bearer tokens.
3. On app boot/session load, call `/v1/integrations/nexa-ai/context`.
4. Gate memory with `ai.memory_enabled`.
5. Gate training data with `ai.training_opt_in`.
6. Gate premium models/tools with `nexa_ai` entitlements.
7. Store only product-specific AI data keyed by `userId`.
8. Do not store Identity refresh tokens in AI backend logs or database.
9. Return guest mode when token validation fails.

## Nexa Browser Implementation Checklist

1. Keep unauthenticated browsing available.
2. Require login for sync, memory, subscriptions, cloud features, and device/session controls.
3. On signed-in startup, call `/v1/integrations/browser/bootstrap`.
4. Gate page reads with `browser.read_current_page`.
5. Gate all-tab reads with `browser.read_all_tabs`.
6. Gate navigation with `browser.navigate`.
7. Gate history/bookmark/download access with their specific scopes.
8. Gate guardian features with `guardian.*` scopes.
9. Require explicit user confirmation for high-risk actions.
10. Store tokens only in secure browser storage or HttpOnly cookies.

## Nexa Cloud/Storage/Database Implementation Checklist

1. Accept user bearer tokens for dashboard/API calls.
2. Accept `nexa_sk_live_...` API keys for machine access.
3. Verify API keys with `/v1/api-keys/verify`.
4. Require scopes such as `storage.read`, `storage.write`, `database.read`, or `database.write`.
5. Key resources by `userId` and optional `organizationId`.
6. Do not store raw API keys.
7. Re-check Identity on authorization failures and subscription changes.

## Nexa GPU/Compute Implementation Checklist

1. Require authenticated user or valid API key.
2. Check `nexa_gpu` entitlement before provisioning.
3. Check billing/subscription state before long-running jobs.
4. Rate-limit and quota-limit by `userId`, `organizationId`, and plan.
5. Audit job creation, cancellation, and expensive resource use in the GPU service.
6. Never let frontend-provided plan data decide compute access.

## Error Handling Contract

Product services should preserve Nexa Identity error meaning:

| Identity response | Product behavior |
| --- | --- |
| `401 unauthorized` | Ask user to log in or refresh session. |
| `403 forbidden` | Show access denied or permission required. |
| `400 bad_request` | Fix client request shape. |
| `409 conflict` | Show already exists or state conflict. |
| `429 rate_limited` | Back off and show retry guidance. |
| `500 internal_error` | Treat as temporary service failure. |

Do not expose raw Identity error stack traces to users.

## Caching Guidance

Recommended cache TTLs in product services:

| Data | TTL |
| --- | --- |
| Token verification | 30-60 seconds |
| Permission checks | 30-60 seconds |
| Entitlement checks | 60-300 seconds |
| Product bootstrap context | 60 seconds |
| API key verification | 30-120 seconds |

Invalidate cache when:

- Identity returns 401 or 403.
- User logs out.
- Subscription checkout completes.
- Admin updates user entitlements.
- Admin resets permissions.
- API key verification fails.

## Security Review Checklist

Before considering integration complete:

- Product service never stores passwords.
- Product service never stores raw API keys.
- Product service never logs bearer tokens or refresh tokens.
- CORS origins point to expected product domains.
- Auth middleware covers every protected route.
- Feature gates check both permission and entitlement when needed.
- Browser automation actions are risk-classified.
- High-risk actions require explicit user confirmation.
- Product service has tests for unauthenticated, unauthorized, expired-token, and missing-entitlement states.
- Product service has graceful fallback when Nexa Identity is unavailable.

## Smoke Tests For Agents

Local:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/ready
curl http://127.0.0.1:4000/v1/billing/readiness
```

Production:

```bash
curl https://identity.trynexa-ai.com/health
curl https://identity.trynexa-ai.com/ready
curl https://identity.trynexa-ai.com/v1/billing/readiness
```

Authenticated smoke test:

```bash
curl https://identity.trynexa-ai.com/v1/auth/me \
  -H "Authorization: Bearer <access token>"
```

Integration smoke test:

```bash
curl https://identity.trynexa-ai.com/v1/integrations/nexa-ai/context \
  -H "Authorization: Bearer <access token>"
```

## What Not To Build In Product Services

Do not build:

- Separate user registration authority.
- Separate password reset system.
- Separate billing plan authority.
- Separate permission source of truth.
- Raw API key storage.
- Admin credential files.
- Product-local admin role system for identity controls.

If a product needs account, plan, permission, or organization state, it should call Nexa Identity.
