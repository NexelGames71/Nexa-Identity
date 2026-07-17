# Vercel Deployment

Production URL:

```text
https://identity.trynexa-ai.com
```

The Vercel function entrypoint is `api/index.ts`. `vercel.json` rewrites all requests to that function so existing routes such as `/health`, `/v1/auth/login`, and `/admin` keep working.

## Required Environment

Use `.env.production.example` as the Vercel environment checklist. Do not upload local `.env` values directly.

Required production values:

- `APP_ENV=production`
- `DATABASE_URL`: managed PostgreSQL with SSL.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: long random secrets.
- `CORS_ALLOWED_ORIGINS=https://identity.trynexa-ai.com`
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_EMAIL_FROM`
- `IDENTITY_BASE_URL=https://identity.trynexa-ai.com`
- `ALLOW_OWNER_BOOTSTRAP=false`

Keep `ADMIN_DASHBOARD_ENABLED=false` for the first public deployment unless admin access is intentionally protected with HTTPS and an IP allowlist.

## Deploy Flow

1. Configure Vercel environment variables.
2. Run `npm run prisma:deploy` against the production database.
3. Deploy to Vercel.
4. Check `https://identity.trynexa-ai.com/health`.
5. Check `https://identity.trynexa-ai.com/ready`.
6. Create the first owner only through the bootstrap command with a temporary production setup token, then immediately set `ALLOW_OWNER_BOOTSTRAP=false`.

## Production Checks

The app fails fast in production if unsafe defaults are detected, including localhost databases, placeholder JWT secrets, missing Resend config, wrong `IDENTITY_BASE_URL`, enabled bootstrap mode, or admin dashboard HTTPS misconfiguration.

`/ready` returns `503` when a required readiness check fails and `200` for `ok` or `degraded`. A degraded result means the API can run but something optional, such as billing or public admin exposure, still needs operational attention.
