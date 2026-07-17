# Nexa Identity

Nexa Identity is the central account, authentication, session, permission, subscription, API key, and organization service for the Nexa ecosystem.

It is intentionally separate from Nexa AI and Nexa Browser. Product backends call Nexa Identity through APIs instead of duplicating user tables or account logic.

## MVP Scope

- Email/username registration and login.
- JWT access tokens plus hashed, rotatable refresh tokens.
- User profile, sessions, devices, permissions, entitlements, subscriptions placeholder, API keys, organizations, audit logs, and admin endpoints.
- Prisma data model designed for Supabase PostgreSQL.
- Strict environment validation and CORS allow-listing.

## Supabase Source of Truth

Nexa Identity is the authentication and verification source for Nexa products. Use Supabase as the PostgreSQL host by setting:

```env
DATABASE_PROVIDER=prisma
DATABASE_URL="postgresql://...supabase.co:5432/postgres?schema=public"
```

Products such as Nexa Web should authenticate against Nexa Identity APIs instead of using a product-local auth provider.

Supabase Auth metadata is exposed through the configured JWKS and OIDC endpoints so Nexa products can verify sessions consistently while keeping Nexa Identity as the account source of truth.

## Local Start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The service starts on `APP_PORT`, default `4000`, with health at `GET /health`.

## Seed Nexa Admin Test Accounts

The admin dashboard uses Nexa Identity admin roles. For local dashboard testing, seed four Nexa admin accounts into both Supabase Auth and the Nexa Identity database:

```powershell
cd "C:\Nexa Identity"
$env:ADMIN_TEST_PASSWORD="replace-with-a-local-test-password"
npm.cmd run identity:seed-admin-tests
```

The script creates:

- `admin.owner.test@trynexa-ai.com` with the `owner` role.
- `admin.platform.test@trynexa-ai.com` with the `admin` role.
- `admin.support.test@trynexa-ai.com` with the `support` role.
- `admin.billing.test@trynexa-ai.com` with the `billing` role.

These are Nexa admin dashboard accounts, not Supabase dashboard accounts.

## Important Security Defaults

Do not commit `.env` files. Refresh tokens and API keys are stored only as hashes. High-risk product actions must be approved by the product UI before execution; Nexa Identity exposes permissions and entitlements for those decisions.
