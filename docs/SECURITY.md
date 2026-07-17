# Security

- Passwords use bcrypt hashing.
- Refresh tokens are JWTs but stored only as SHA-256 hashes.
- Refresh tokens rotate on refresh.
- API keys are shown once and stored only as hashes.
- Email verification and password reset tokens are shown only in non-production fallback responses until an email provider is connected.
- Password reset tokens are stored only as hashes, expire after one hour, and revoke active sessions after use.
- Organization invite tokens are stored only as hashes and expire after seven days.
- Development email logging redacts message text so account-control tokens are not written to logs.
- Resend email delivery runs only through the backend EmailService. Resend API keys must stay in `.env` or a secret manager.
- Login and refresh responses also set `HttpOnly` auth cookies for browser-based sessions. Cookies are marked `Secure` in production.
- CORS is restricted through `CORS_ALLOWED_ORIGINS`.
- Auth routes are rate-limit ready; general API traffic is rate-limited.
- Admin endpoints require `role = admin`.
- Internal admin access uses normal Nexa Identity IAM plus `AdminRole` and separate hashed `AdminSession` records.
- Do not use admin credential files. Create the first owner with the bootstrap command and then disable bootstrap mode.
- Important security events create audit logs.
- Billing checkout creation, subscription cancellation requests, and admin subscription changes are audited.
- PayPal credentials must only live in environment variables or a secret manager. Never commit PayPal client secrets.

Future hardening:

- Add email verification delivery.
- Add device fingerprint review.
- Add service-to-service token verification for internal products.
