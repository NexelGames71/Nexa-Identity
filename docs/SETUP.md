# Setup

1. Install Node.js 20 or newer.
2. Create or select the Nexa Supabase project.
3. Copy `.env.example` to `.env` and set real secrets.
4. Run `npm install`.
5. Run `npm run prisma:generate`.
6. Run `npm run prisma:migrate` and `npm run prisma:seed`.
7. Start with `npm run dev`.

Required secrets must be long random values, especially `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

Health is available at `GET /health`.

The MVP account dashboard is available at `GET /account`.

## Supabase Database

Nexa Identity uses Supabase PostgreSQL through Prisma. Set:

```bash
DATABASE_PROVIDER=prisma
DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_PERCENT_ENCODED_PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?schema=public&sslmode=require"
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_OIDC_TOKEN_ENDPOINT=https://your-project.supabase.co/auth/v1/oauth/token
SUPABASE_OIDC_AUTHORIZATION_ENDPOINT=https://your-project.supabase.co/auth/v1/oauth/authorize
SUPABASE_OIDC_DISCOVERY_URL=https://your-project.supabase.co/auth/v1/.well-known/openid-configuration
```

Use the Supabase transaction pooler for Vercel/serverless deployments. The URL should have exactly one `@` between credentials and host. If the database password itself contains special characters, percent-encode those characters before putting them in `DATABASE_URL`; for example, a password-owned `@` must be written as `%40`.

Nexa products should authenticate through Nexa Identity APIs. Supabase is the database host and OIDC/Auth metadata provider, not a product-local replacement for Nexa Identity.

For PayPal billing, put credentials only in `.env`:

```bash
BILLING_PROVIDER=paypal
PAYPAL_CLIENT_ID=your-rotated-client-id
PAYPAL_CLIENT_SECRET=your-rotated-client-secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_IDS={}
```

Nexa Identity owns PayPal products and subscription plan IDs. The sandbox/live plan files are
`paypal-plans.sandbox.json` and `paypal-plans.live.json`, and the runtime defaults live in
`src/subscriptions/paypal-plan-config.ts`. `PAYPAL_PLAN_IDS` is only needed when you want an environment-level override.

To create or rotate PayPal plans from Identity:

```powershell
cd "C:\Nexa Identity"
$env:PAYPAL_ENVIRONMENT="sandbox"
npm.cmd run paypal:create-plans
npm.cmd run paypal:sync-plan-config -- --env sandbox
```

For live PayPal plans, set `PAYPAL_ENVIRONMENT=live` and pass `--confirm-live`:

```powershell
$env:PAYPAL_ENVIRONMENT="live"
npm.cmd run paypal:create-plans -- --confirm-live
npm.cmd run paypal:sync-plan-config -- --env live
```

For Resend email delivery, put credentials only in `.env`:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Nexa <noreply@your-verified-domain.com>"
ADMIN_EMAIL_FROM="Nexa Admin <admin@admin.nexaidentity.com>"
IDENTITY_BASE_URL=http://localhost:4000
```
