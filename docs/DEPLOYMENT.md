# Deployment

Production deployment requires:

- Managed PostgreSQL.
- Strong secrets in a secret manager.
- HTTPS termination.
- Restricted CORS origins.
- Database backups.
- Centralized logs with token/password redaction.
- Monitoring for failed logins, account lockouts, and suspicious refresh-token reuse.

## Vercel Production Target

The production address is:

```text
https://identity.trynexa-ai.com
```

This repo includes:

- `api/index.ts`: Vercel serverless entrypoint for the Express app.
- `vercel.json`: routes all requests to the API function.
- `.env.production.example`: production environment checklist.
- `npm run vercel-build`: generates Prisma Client and type-checks the app.

Set these Vercel environment variables at minimum:

```env
APP_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public&sslmode=require
JWT_ACCESS_SECRET=<64+ character random secret>
JWT_REFRESH_SECRET=<64+ character random secret>
CORS_ALLOWED_ORIGINS=https://identity.trynexa-ai.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=<resend production key>
EMAIL_FROM=Nexa <noreply@nexaidentity.com>
ADMIN_EMAIL_FROM=Nexa Admin <admin@admin.nexaidentity.com>
IDENTITY_BASE_URL=https://identity.trynexa-ai.com
ALLOW_OWNER_BOOTSTRAP=false
ADMIN_DASHBOARD_ENABLED=false
ADMIN_REQUIRE_HTTPS=true
```

For paid subscriptions also set:

```env
BILLING_PROVIDER=paypal
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=<paypal live client id>
PAYPAL_CLIENT_SECRET=<paypal live secret>
PAYPAL_PLAN_IDS={}
```

Identity ships the current Nexa PayPal plan references in `src/subscriptions/paypal-plan-config.ts`,
backed by `paypal-plans.sandbox.json` and `paypal-plans.live.json`. Use `PAYPAL_PLAN_IDS` only for
an emergency environment-level override.

## Release Commands

Before promoting a deployment, run locally or in CI:

```bash
npm run build
npm test
npm run lint
```

Run migrations against the production database as a release step:

```bash
npm run prisma:deploy
```

The initial migration lives under `prisma/migrations` and creates the full identity schema. Run migrations as a release step before starting the application.

Billing defaults to the manual provider. Set `BILLING_PROVIDER=paypal` plus PayPal credentials to enable checkout. `GET /v1/billing/readiness` reports missing billing configuration without exposing secrets.

To rotate PayPal products or plans from Identity:

```powershell
npm.cmd run paypal:create-plans
npm.cmd run paypal:sync-plan-config -- --env sandbox
```

For live plan rotation, set `PAYPAL_ENVIRONMENT=live` and add `--confirm-live` to `paypal:create-plans`.

## Smoke Tests

After deployment:

```bash
curl https://identity.trynexa-ai.com/health
curl https://identity.trynexa-ai.com/ready
curl https://identity.trynexa-ai.com/v1/billing/readiness
```

`/health` confirms the API is up. `/ready` performs safe readiness checks for database connectivity and production configuration without exposing secrets. `/v1/billing/readiness` reports billing provider readiness.

## Production Guardrails

When `APP_ENV=production`, the service refuses to boot if:

- JWT secrets still look like placeholders.
- `DATABASE_URL` points at localhost.
- Resend is not configured.
- `IDENTITY_BASE_URL` is not `https://identity.trynexa-ai.com`.
- owner bootstrap is still enabled.
- the admin dashboard is enabled without HTTPS enforcement.

Keep `ADMIN_DASHBOARD_ENABLED=false` for first production launch unless the deployment is behind an IP allowlist and the owner account has been bootstrapped.
