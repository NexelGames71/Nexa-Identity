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
DATABASE_URL="postgresql://postgres:YOUR_PERCENT_ENCODED_PASSWORD@db.your-project.supabase.co:5432/postgres?schema=public&sslmode=require"
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_OIDC_TOKEN_ENDPOINT=https://your-project.supabase.co/auth/v1/oauth/token
SUPABASE_OIDC_AUTHORIZATION_ENDPOINT=https://your-project.supabase.co/auth/v1/oauth/authorize
SUPABASE_OIDC_DISCOVERY_URL=https://your-project.supabase.co/auth/v1/.well-known/openid-configuration
```

Nexa products should authenticate through Nexa Identity APIs. Supabase is the database host and OIDC/Auth metadata provider, not a product-local replacement for Nexa Identity.

For PayPal billing, put credentials only in `.env`:

```bash
BILLING_PROVIDER=paypal
PAYPAL_CLIENT_ID=your-rotated-client-id
PAYPAL_CLIENT_SECRET=your-rotated-client-secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_IDS='{"plus":"P-...","pro":"P-...","premium":"P-...","business":"P-..."}'
```

For Resend email delivery, put credentials only in `.env`:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Nexa <noreply@your-verified-domain.com>"
ADMIN_EMAIL_FROM="Nexa Admin <admin@admin.nexaidentity.com>"
IDENTITY_BASE_URL=http://localhost:4000
```
